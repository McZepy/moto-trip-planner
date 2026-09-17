// One-shot patch for V0.5C day routing integration.
import fs from 'node:fs/promises'

const APP_PATH = new URL('../src/App.tsx', import.meta.url)
let source = await fs.readFile(APP_PATH, 'utf8')

if (
  source.includes('const handleSelectDayRoute =') &&
  source.includes('onShowOverview={handleShowTripOverview}')
) {
  console.log('Routing giornate già integrato')
  process.exit(0)
}

function replaceOnce(label, search, replacement) {
  const first = source.indexOf(search)
  if (first < 0) {
    throw new Error(`Patch ${label}: blocco sorgente non trovato`)
  }

  const second = source.indexOf(search, first + search.length)
  if (second >= 0) {
    throw new Error(`Patch ${label}: blocco sorgente non univoco`)
  }

  source =
    source.slice(0, first) +
    replacement +
    source.slice(first + search.length)
}

replaceOnce(
  'imports-day-routing',
  `import type { TripDay } from './types/tripDay'\nimport { TripsModal } from './components/TripsModal'`,
  `import type { TripDay } from './types/tripDay'\nimport {\n  clearTripDayPlaceCache,\n  planTripDayRoute,\n  planTripDaysRoute,\n  type TripDayRouteStats,\n} from './itinerary/tripDayRoutePlanner'\nimport { showTripRoutePlan } from './map/showTripRoutePlan'\nimport { TripsModal } from './components/TripsModal'`,
)

replaceOnce(
  'day-routing-state',
  `  const [\n    days,\n    setDays,\n  ] =\n    useState<TripDay[]>([])\n\n  const [\n    editingWaypoint,`,
  `  const [\n    days,\n    setDays,\n  ] =\n    useState<TripDay[]>([])\n\n  const [\n    selectedDayId,\n    setSelectedDayId,\n  ] =\n    useState<string | null>(null)\n\n  const [\n    dayRouteStats,\n    setDayRouteStats,\n  ] =\n    useState<Record<string, TripDayRouteStats>>({})\n\n  const [\n    daysRoutingBusy,\n    setDaysRoutingBusy,\n  ] =\n    useState(false)\n\n  const [\n    daysRoutingProgress,\n    setDaysRoutingProgress,\n  ] =\n    useState<string | null>(null)\n\n  const [\n    editingWaypoint,`,
)

replaceOnce(
  'reset-day-routing',
  `      setWaypoints([])\n      setDays([])\n\n      closeWaypointEditor()`,
  `      setWaypoints([])\n      setDays([])\n      setSelectedDayId(null)\n      setDayRouteStats({})\n      setDaysRoutingBusy(false)\n      setDaysRoutingProgress(null)\n      clearTripDayPlaceCache()\n\n      closeWaypointEditor()`,
)

replaceOnce(
  'load-day-routing',
  `      setDays(\n        trip.days ?? [],\n      )\n\n      setDistance(`,
  `      setDays(\n        trip.days ?? [],\n      )\n\n      setSelectedDayId(null)\n      setDayRouteStats({})\n      setDaysRoutingBusy(false)\n      setDaysRoutingProgress(null)\n      clearTripDayPlaceCache()\n\n      setDistance(`,
)

replaceOnce(
  'handlers',
  `  const autocompleteStart =\n    async (`,
  `  const handleDaysChange =\n    (nextDays: TripDay[]) => {\n      setDays(nextDays)\n      setSelectedDayId(null)\n      setDayRouteStats({})\n      setDaysRoutingProgress(null)\n      clearTripDayPlaceCache()\n      removeRoute()\n      setDistance(null)\n      setDuration(null)\n    }\n\n  const handleSelectDayRoute =\n    async (day: TripDay) => {\n      const map = mapRef.current\n\n      if (!map || daysRoutingBusy) {\n        return\n      }\n\n      setDaysRoutingBusy(true)\n      setSelectedDayId(day.id)\n      setDaysRoutingProgress(\n        \\`Giorno \\${day.dayNumber}: individuo le località e calcolo il percorso...\\`,\n      )\n\n      try {\n        const result =\n          await planTripDayRoute(\n            day,\n            tripSettings.roadPreferences.allowFerries,\n          )\n\n        showTripRoutePlan(\n          map,\n          result.plan,\n        )\n\n        setDayRouteStats(\n          (current) => ({\n            ...current,\n            [day.id]: result.stats,\n          }),\n        )\n\n        setStatus(\n          \\`Giorno \\${day.dayNumber}: \\${formatDistance(result.plan.distanceMeters)} · \\${formatDuration(result.plan.durationSeconds)}.\\`,\n        )\n      } catch (error) {\n        console.error(error)\n        setStatus(\n          error instanceof Error\n            ? error.message\n            : 'Errore durante il calcolo della giornata.',\n        )\n      } finally {\n        setDaysRoutingBusy(false)\n        setDaysRoutingProgress(null)\n      }\n    }\n\n  const handleShowTripOverview =\n    async () => {\n      const map = mapRef.current\n\n      if (\n        !map ||\n        daysRoutingBusy ||\n        days.length === 0\n      ) {\n        return\n      }\n\n      setDaysRoutingBusy(true)\n      setSelectedDayId(null)\n      setDaysRoutingProgress(\n        \\`Calcolo viaggio completo: 0/\\${days.length} giornate...\\`,\n      )\n\n      try {\n        const result =\n          await planTripDaysRoute(\n            days,\n            tripSettings.roadPreferences.allowFerries,\n            (completed, total, day) => {\n              setDaysRoutingProgress(\n                \\`Calcolo viaggio completo: \\${completed}/\\${total} · completato giorno \\${day.dayNumber}.\\`,\n              )\n            },\n          )\n\n        showTripRoutePlan(\n          map,\n          result.plan,\n        )\n\n        const stats =\n          Object.fromEntries(\n            result.dayResults.map(\n              (dayResult) => [\n                dayResult.day.id,\n                dayResult.stats,\n              ],\n            ),\n          ) as Record<string, TripDayRouteStats>\n\n        setDayRouteStats(stats)\n        setDistance(\n          result.plan.distanceMeters,\n        )\n        setDuration(\n          result.plan.durationSeconds,\n        )\n\n        setStatus(\n          \\`Viaggio completo: \\${formatDistance(result.plan.distanceMeters)} · \\${formatDuration(result.plan.durationSeconds)}.\\`,\n        )\n      } catch (error) {\n        console.error(error)\n        setStatus(\n          error instanceof Error\n            ? error.message\n            : 'Errore durante il calcolo del viaggio completo.',\n        )\n      } finally {\n        setDaysRoutingBusy(false)\n        setDaysRoutingProgress(null)\n      }\n    }\n\n  const autocompleteStart =\n    async (`,
)

replaceOnce(
  'days-panel-props',
  `            <DaysHotelPanel\n              days={days}\n              onChange={setDays}\n              onStatus={setStatus}\n            />`,
  `            <DaysHotelPanel\n              days={days}\n              selectedDayId={selectedDayId}\n              routeStats={dayRouteStats}\n              routingBusy={daysRoutingBusy}\n              routingProgress={daysRoutingProgress}\n              onChange={handleDaysChange}\n              onSelectDay={handleSelectDayRoute}\n              onShowOverview={handleShowTripOverview}\n              onStatus={setStatus}\n            />`,
)

await fs.writeFile(APP_PATH, source)
console.log('Routing giornate integrato in App.tsx')
