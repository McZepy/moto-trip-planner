import fs from 'node:fs/promises'

const ALT_PATH = new URL('../src/providers/tripRouteAlternatives.ts', import.meta.url)
const MULTI_PATH = new URL('../src/providers/multiLegTripPlanner.ts', import.meta.url)
const DAY_PATH = new URL('../src/itinerary/tripDayRoutePlanner.ts', import.meta.url)
const APP_PATH = new URL('../src/App.tsx', import.meta.url)

function replaceOnce(source, label, search, replacement) {
  const first = source.indexOf(search)
  if (first < 0) throw new Error(`Patch ${label}: blocco non trovato`)
  const second = source.indexOf(search, first + search.length)
  if (second >= 0) throw new Error(`Patch ${label}: blocco non univoco`)
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

function replaceFrom(source, label, sectionMarker, search, replacement) {
  const section = source.indexOf(sectionMarker)
  if (section < 0) throw new Error(`Patch ${label}: sezione non trovata`)
  const first = source.indexOf(search, section)
  if (first < 0) throw new Error(`Patch ${label}: blocco non trovato`)
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

// 1. Route alternatives: permette di iniettare il motore stradale scelto.
let alternatives = await fs.readFile(ALT_PATH, 'utf8')
if (!alternatives.includes('routingProvider?:\n    RoutingProvider')) {
  alternatives = replaceOnce(
    alternatives,
    'alternatives-import-provider',
    `import type {\n  RoutePoint,\n} from './routingProvider'`,
    `import type {\n  RoutePoint,\n  RoutingProvider,\n} from './routingProvider'`,
  )

  alternatives = replaceOnce(
    alternatives,
    'alternatives-signature',
    `export async function planFastestRouteAlternatives(\n  start: RoutePoint,\n  destination: RoutePoint,\n  allowFerries: boolean,\n): Promise<RouteAlternativesResult> {`,
    `export async function planFastestRouteAlternatives(\n  start: RoutePoint,\n  destination: RoutePoint,\n  allowFerries: boolean,\n  routingProvider?:\n    RoutingProvider,\n): Promise<RouteAlternativesResult> {`,
  )

  alternatives = replaceOnce(
    alternatives,
    'alternatives-evaluator-provider',
    `        includeKnownFerries:\n          allowFerries,\n      },`,
    `        includeKnownFerries:\n          allowFerries,\n        routingProvider,\n      },`,
  )

  alternatives = alternatives.replace(
    `label:\n        'Percorso diretto OSRM',`,
    `label:\n        'Percorso diretto stradale',`,
  )

  await fs.writeFile(ALT_PATH, alternatives)
}

// 2. Multi-leg: passa lo stesso provider a ogni segmento.
let multi = await fs.readFile(MULTI_PATH, 'utf8')
if (!multi.includes('routingProvider?:\n    RoutingProvider')) {
  multi = replaceOnce(
    multi,
    'multi-import-provider',
    `import type {\n  RoutePoint,\n} from './routingProvider'`,
    `import type {\n  RoutePoint,\n  RoutingProvider,\n} from './routingProvider'`,
  )

  multi = replaceOnce(
    multi,
    'multi-signature',
    `export async function planMultiLegRoute(\n  points:\n    RoutePoint[],\n  allowFerries:\n    boolean,\n): Promise<MultiLegRoutePlan> {`,
    `export async function planMultiLegRoute(\n  points:\n    RoutePoint[],\n  allowFerries:\n    boolean,\n  routingProvider?:\n    RoutingProvider,\n): Promise<MultiLegRoutePlan> {`,
  )

  multi = replaceOnce(
    multi,
    'multi-pass-provider',
    `        from,\n        to,\n        allowFerries,\n      )`,
    `        from,\n        to,\n        allowFerries,\n        routingProvider,\n      )`,
  )

  await fs.writeFile(MULTI_PATH, multi)
}

// 3. Giornate: usa TomTom anche nei percorsi importati e nel viaggio completo.
let day = await fs.readFile(DAY_PATH, 'utf8')
if (!day.includes("type RoutingProvider")) {
  day = replaceOnce(
    day,
    'day-import-provider',
    `import type { GeocodingResult } from '../providers/geocodingProvider'`,
    `import type { GeocodingResult } from '../providers/geocodingProvider'\nimport type { RoutingProvider } from '../providers/routingProvider'`,
  )

  day = replaceOnce(
    day,
    'day-leg-signature',
    `  from: GeocodingResult,\n  to: GeocodingResult,\n): Promise<TripRoutePlan> {`,
    `  from: GeocodingResult,\n  to: GeocodingResult,\n  routingProvider?:\n    RoutingProvider,\n): Promise<TripRoutePlan> {`,
  )

  day = replaceOnce(
    day,
    'day-leg-provider',
    `      },\n      leg.explicitFerry,\n    )`,
    `      },\n      leg.explicitFerry,\n      routingProvider,\n    )`,
  )

  day = replaceOnce(
    day,
    'day-route-signature',
    `export async function planTripDayRoute(\n  day: TripDay,\n  _allowAutomaticFerries: boolean,\n  anchor?: GeocodingResult,\n): Promise<TripDayRouteResult> {`,
    `export async function planTripDayRoute(\n  day: TripDay,\n  _allowAutomaticFerries: boolean,\n  anchor?: GeocodingResult,\n  routingProvider?:\n    RoutingProvider,\n): Promise<TripDayRouteResult> {`,
  )

  day = replaceOnce(
    day,
    'day-plan-leg-provider',
    `        leg,\n        from,\n        to,\n      ),`,
    `        leg,\n        from,\n        to,\n        routingProvider,\n      ),`,
  )

  day = replaceOnce(
    day,
    'days-route-signature',
    `  onProgress?: (\n    completed: number,\n    total: number,\n    day: TripDay,\n  ) => void,\n): Promise<TripDaysRouteResult> {`,
    `  onProgress?: (\n    completed: number,\n    total: number,\n    day: TripDay,\n  ) => void,\n  routingProvider?:\n    RoutingProvider,\n): Promise<TripDaysRouteResult> {`,
  )

  day = replaceOnce(
    day,
    'days-pass-provider',
    `        day,\n        allowAutomaticFerries,\n        anchor,\n      )`,
    `        day,\n        allowAutomaticFerries,\n        anchor,\n        routingProvider,\n      )`,
  )

  await fs.writeFile(DAY_PATH, day)
}

// 4. App: TomTom diventa il motore stradale runtime per editor, giornate e viaggio completo.
let app = await fs.readFile(APP_PATH, 'utf8')
if (!app.includes("from './providers/tomTomRoutingProvider'")) {
  app = replaceOnce(
    app,
    'app-import-tomtom',
    `import {\n  type RoutePoint,\n} from './providers/routingProvider'`,
    `import {\n  type RoutePoint,\n} from './providers/routingProvider'\n\nimport {\n  createTomTomRoutingProvider,\n} from './providers/tomTomRoutingProvider'`,
  )

  app = replaceOnce(
    app,
    'app-provider-helper',
    `function formatDistance(\n  meters: number,\n) {`,
    `function createRoadRoutingProvider(\n  settings: TripSettings,\n) {\n  return createTomTomRoutingProvider({\n    routeStyle:\n      settings.routeStyle,\n    roadPreferences:\n      settings.roadPreferences,\n    traffic:\n      false,\n  })\n}\n\nfunction formatDistance(\n  meters: number,\n) {`,
  )

  app = replaceFrom(
    app,
    'app-day-route-provider',
    'const handleSelectDayRoute =',
    `          await planTripDayRoute(\n            day,\n            tripSettings.roadPreferences.allowFerries,\n          )`,
    `          await planTripDayRoute(\n            day,\n            tripSettings.roadPreferences.allowFerries,\n            undefined,\n            createRoadRoutingProvider(\n              tripSettings,\n            ),\n          )`,
  )

  app = replaceFrom(
    app,
    'app-overview-provider',
    'const handleShowTripOverview =',
    `            },\n          )`,
    `            },\n            createRoadRoutingProvider(\n              tripSettings,\n            ),\n          )`,
  )

  app = replaceFrom(
    app,
    'app-main-provider',
    'const calculateRoute =',
    `              tripSettings\n                .roadPreferences\n                .allowFerries,\n            )`,
    `              tripSettings\n                .roadPreferences\n                .allowFerries,\n\n              createRoadRoutingProvider(\n                tripSettings,\n              ),\n            )`,
  )

  app = replaceOnce(
    app,
    'app-routing-dependencies',
    `    tripSettings\n      .roadPreferences\n      .allowFerries,\n  ])`,
    `    tripSettings\n      .routeStyle,\n    tripSettings\n      .roadPreferences\n      .allowFerries,\n    tripSettings\n      .roadPreferences\n      .avoidUnpaved,\n    tripSettings\n      .roadPreferences\n      .avoidMotorways,\n    tripSettings\n      .roadPreferences\n      .avoidTolls,\n    tripSettings\n      .roadPreferences\n      .avoidNarrowRoads,\n    tripSettings\n      .roadPreferences\n      .avoidUrbanAreas,\n  ])`,
  )

  await fs.writeFile(APP_PATH, app)
}

console.log('TomTom runtime routing integrato')
