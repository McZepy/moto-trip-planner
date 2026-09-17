import fs from 'node:fs/promises'

const APP_PATH = new URL('../src/App.tsx', import.meta.url)

let source = await fs.readFile(APP_PATH, 'utf8')

if (
  source.includes("import { DaysHotelPanel } from './components/DaysHotelPanel'") &&
  source.includes('const [\n    days,\n    setDays,')
) {
  console.log('Giornate UI già integrata')
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
  'imports',
  `import { TripsModal } from './components/TripsModal'\nimport { TripSettingsModal } from './components/TripSettingsModal'\n\nsetWorkerUrl(workerUrl)`,
  `import type { TripDay } from './types/tripDay'\nimport { TripsModal } from './components/TripsModal'\nimport { TripSettingsModal } from './components/TripSettingsModal'\nimport { DaysHotelPanel } from './components/DaysHotelPanel'\n\nsetWorkerUrl(workerUrl)`,
)

replaceOnce(
  'days-state',
  `  const [\n    waypoints,\n    setWaypoints,\n  ] =\n    useState<\n      Waypoint[]\n    >([])\n\n  const [\n    editingWaypoint,`,
  `  const [\n    waypoints,\n    setWaypoints,\n  ] =\n    useState<\n      Waypoint[]\n    >([])\n\n  const [\n    days,\n    setDays,\n  ] =\n    useState<TripDay[]>([])\n\n  const [\n    editingWaypoint,`,
)

replaceOnce(
  'reset-days',
  `      setWaypoints([])\n\n      closeWaypointEditor()`,
  `      setWaypoints([])\n      setDays([])\n\n      closeWaypointEditor()`,
)

replaceOnce(
  'save-validation',
  `      if (\n        !startPlace ||\n        !destinationPlace\n      ) {\n        setStatus(\n          'Imposta partenza e destinazione prima di salvare.',\n        )\n\n        return\n      }`,
  `      if (\n        (!startPlace ||\n          !destinationPlace) &&\n        days.length === 0\n      ) {\n        setStatus(\n          'Imposta partenza e destinazione oppure crea almeno una giornata prima di salvare.',\n        )\n\n        return\n      }`,
)

replaceOnce(
  'save-days',
  `            waypoints,\n\n            settings:`,
  `            waypoints,\n\n            days,\n\n            settings:`,
)

replaceOnce(
  'saved-days',
  `      setTripSettings(\n        cloneTripSettings(\n          saved.settings,\n        ),\n      )\n\n      refreshSavedTrips()`,
  `      setTripSettings(\n        cloneTripSettings(\n          saved.settings,\n        ),\n      )\n\n      setDays(\n        saved.days ?? [],\n      )\n\n      refreshSavedTrips()`,
)

replaceOnce(
  'load-days',
  `      setWaypoints(\n        trip.waypoints ?? [],\n      )\n\n      setDistance(`,
  `      setWaypoints(\n        trip.waypoints ?? [],\n      )\n\n      setDays(\n        trip.days ?? [],\n      )\n\n      setDistance(`,
)

replaceOnce(
  'load-section',
  `      syncWaypointMarkers(\n        trip.waypoints ?? [],\n      )\n\n      setActiveSection(\n        'itinerary',\n      )`,
  `      syncWaypointMarkers(\n        trip.waypoints ?? [],\n      )\n\n      setActiveSection(\n        (trip.days?.length ?? 0) > 0\n          ? 'days'\n          : 'itinerary',\n      )`,
)

replaceOnce(
  'days-panel',
  `      if (\n        activeSection ===\n        'days'\n      ) {\n        return (\n          <section className="sidebar-section">\n            <h2>\n              Giornate & Hotel\n            </h2>\n\n            <div className="placeholder-card">\n              <strong>\n                Viaggio multi-giorno\n              </strong>\n\n              <p>\n                Qui divideremo il tour in giornate,\n                pernottamenti e timeline.\n              </p>\n\n              <span>\n                Funzione in preparazione\n              </span>\n            </div>\n          </section>\n        )\n      }`,
  `      if (\n        activeSection ===\n        'days'\n      ) {\n        return (\n          <section className="sidebar-section">\n            <h2>\n              Giornate & Hotel\n            </h2>\n\n            <DaysHotelPanel\n              days={days}\n              onChange={setDays}\n              onStatus={setStatus}\n            />\n\n            <p className="route-status">\n              {status}\n            </p>\n          </section>\n        )\n      }`,
)

await fs.writeFile(APP_PATH, source)
console.log('Giornate & Hotel integrata in App.tsx')
