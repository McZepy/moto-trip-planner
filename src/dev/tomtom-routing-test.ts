import {
  buildTomTomRoutingParameters,
  createTomTomRoutingProvider,
  getTomTomAvoids,
  getTomTomRouteProfile,
  hasTomTomApiKey,
} from '../providers/tomTomRoutingProvider'

import type {
  TripRoadPreferences,
} from '../types/trip'

const preferences:
  TripRoadPreferences = {
  avoidUnpaved:
    true,
  avoidMotorways:
    false,
  avoidTolls:
    false,
  avoidNarrowRoads:
    false,
  avoidUrbanAreas:
    false,
  allowFerries:
    true,
}

const viganò = {
  lat: 45.727,
  lng: 9.324,
}

const como = {
  lat: 45.8081,
  lng: 9.0852,
}

type TestResult = {
  name: string
  ok: boolean
  detail?: string
}

const results:
  TestResult[] = []

function check(
  name: string,
  ok: boolean,
  detail?: string,
) {
  results.push({
    name,
    ok,
    detail,
  })
}

function formatKm(
  meters: number,
) {
  return (
    `${(meters / 1000).toFixed(1)} km`
  )
}

async function run() {
  check(
    'Chiave TomTom configurata',
    hasTomTomApiKey(),
  )

  const fast =
    getTomTomRouteProfile(
      'fast',
    )

  check(
    'Profilo Veloce usa fastest',
    fast.routeType ===
      'fastest',
  )

  const curvy =
    getTomTomRouteProfile(
      'curvy',
    )

  check(
    'Profilo Curve usa thrilling + windingness high',
    curvy.routeType ===
      'thrilling' &&
      curvy.windingness ===
        'high',
  )

  const avoids =
    getTomTomAvoids({
      ...preferences,
      avoidMotorways:
        true,
      avoidTolls:
        true,
    })

  check(
    'Preferenze tradotte in ferries/unpaved/motorways/tollRoads',
    [
      'ferries',
      'unpavedRoads',
      'motorways',
      'tollRoads',
    ].every(
      (item) =>
        avoids.includes(item),
    ),
    avoids.join(', '),
  )

  const settings =
    buildTomTomRoutingParameters({
      routeStyle:
        'fast',
      roadPreferences:
        preferences,
    })

  check(
    'Routing stradale forza sempre evita traghetti',
    settings.avoids.includes(
      'ferries',
    ),
    settings.avoids.join(', '),
  )

  if (
    hasTomTomApiKey()
  ) {
    try {
      const fastProvider =
        createTomTomRoutingProvider({
          routeStyle:
            'fast',
          roadPreferences:
            preferences,
          traffic:
            false,
        })

      const route =
        await fastProvider
          .calculateRoute([
            viganò,
            como,
          ])

      check(
        'TomTom live restituisce Viganò → Como',
        route.geometry
          .coordinates
          .length > 2,
        `${formatKm(route.distanceMeters)} · ${route.geometry.coordinates.length} punti`,
      )

      check(
        'Viganò → Como ha distanza plausibile',
        route.distanceMeters >=
          20_000 &&
          route.distanceMeters <=
          50_000,
        formatKm(
          route.distanceMeters,
        ),
      )
    } catch (error) {
      check(
        'TomTom live restituisce Viganò → Como',
        false,
        error instanceof Error
          ? error.message
          : String(error),
      )

      check(
        'Viganò → Como ha distanza plausibile',
        false,
        'Test live non disponibile.',
      )
    }
  } else {
    check(
      'TomTom live restituisce Viganò → Como',
      false,
      'VITE_TOMTOM_KEY mancante.',
    )

    check(
      'Viganò → Como ha distanza plausibile',
      false,
      'VITE_TOMTOM_KEY mancante.',
    )
  }

  const passed =
    results.filter(
      (result) =>
        result.ok,
    ).length

  const root =
    document.getElementById(
      'test-root',
    )

  if (!root) {
    throw new Error(
      'Elemento #test-root non trovato.',
    )
  }

  root.innerHTML = `
    <h1>MotoRoute · TomTom Routing Test</h1>
    <div class="summary ${passed === results.length ? 'ok-summary' : 'ko-summary'}">
      ${passed}/${results.length} test superati
    </div>
    ${results
      .map(
        (result) => `
          <div class="test-row ${result.ok ? 'ok' : 'ko'}">
            <strong>${result.ok ? 'OK' : 'KO'}</strong>
            <div>
              <div>${result.name}</div>
              ${result.detail ? `<small>${result.detail}</small>` : ''}
            </div>
          </div>
        `,
      )
      .join('')}
  `
}

void run()
