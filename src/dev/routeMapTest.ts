import {
  LngLatBounds,
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl'

import 'maplibre-gl/dist/maplibre-gl.css'

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import {
  mapProvider,
} from '../config/mapProvider'

import {
  planFastestRouteAlternatives,
} from '../providers/tripRouteAlternatives'

import {
  drawPlannedRoute,
} from '../map/routeSectionRenderer'

setWorkerUrl(
  workerUrl,
)

const start = {
  lat: 57.5925,
  lng: 9.9628,
}

const destination = {
  lat: 60.392,
  lng: 5.311,
}

const mapElement =
  document.querySelector<HTMLDivElement>(
    '#map',
  )

const summaryElement =
  document.querySelector<HTMLDivElement>(
    '#summary',
  )

if (
  !mapElement ||
  !summaryElement
) {
  throw new Error(
    'Pagina test non valida.',
  )
}

const map =
  new Map({
    container:
      mapElement,

    style:
      mapProvider.styleUrl,

    center: [
      8,
      59,
    ],

    zoom:
      5,
  })

map.addControl(
  new NavigationControl(),
  'top-right',
)

new Marker({
  color:
    '#16a34a',
})
  .setLngLat([
    start.lng,
    start.lat,
  ])
  .addTo(
    map,
  )

new Marker({
  color:
    '#dc2626',
})
  .setLngLat([
    destination.lng,
    destination.lat,
  ])
  .addTo(
    map,
  )

function formatDistance(
  meters: number,
) {
  return `${
    (
      meters /
      1000
    ).toFixed(
      1,
    )
  } km`
}

function formatDuration(
  seconds: number,
) {
  const totalMinutes =
    Math.round(
      seconds /
      60,
    )

  const hours =
    Math.floor(
      totalMinutes /
      60,
    )

  const minutes =
    totalMinutes %
    60

  return (
    `${hours} h ` +
    `${minutes} min`
  )
}

function sectionLabel(
  type:
    'road' |
    'ferry',
) {
  return (
    type ===
    'ferry'
      ? 'TRAGHETTO'
      : 'STRADA'
  )
}

map.on(
  'load',
  async () => {
    try {
      const result =
        await planFastestRouteAlternatives(
          start,
          destination,
          true,
        )

      const plan =
        result.selected.plan

      drawPlannedRoute(
        map,
        plan,
      )

      const bounds =
        plan.sections
          .flatMap(
            (
              section,
            ) =>
              section
                .geometry
                .coordinates,
          )
          .reduce(
            (
              currentBounds,
              coordinate,
            ) =>
              currentBounds
                .extend(
                  coordinate as [
                    number,
                    number,
                  ],
                ),

            new LngLatBounds(
              [
                start.lng,
                start.lat,
              ],
              [
                start.lng,
                start.lat,
              ],
            ),
          )

      map.fitBounds(
        bounds,
        {
          padding:
            70,
        },
      )

      summaryElement
        .innerHTML = `
          <strong>
            ${result.selected.label}
          </strong>

          <div>
            ${
              plan.sections
                .map(
                  (
                    section,
                  ) =>
                    sectionLabel(
                      section.type,
                    ),
                )
                .join(
                  ' → ',
                )
            }
          </div>

          <div>
            ${formatDistance(
              plan.distanceMeters,
            )}
            ·
            ${formatDuration(
              plan.durationSeconds,
            )}
          </div>

          <div class="legend">
            <span>
              <i class="road"></i>
              STRADA
            </span>

            <span>
              <i class="ferry"></i>
              TRAGHETTO
            </span>
          </div>
        `
    } catch (
      error
    ) {
      summaryElement
        .textContent =
          error instanceof
          Error
            ? error.message
            : 'Errore durante il test.'
    }
  },
)
