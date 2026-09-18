import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  candidateRoadDistances,
  cumulativeTargetsKm,
  pointAtRoadDistance,
  roadDistanceMeters,
} from '../itinerary/routeDaySplitter'

import {
  hotelSearchUrl,
} from '../itinerary/hotelSearchLinks'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const tests:
  TestResult[] = []

function check(
  name: string,
  ok: boolean,
  detail: string,
) {
  tests.push({
    name,
    ok,
    detail,
  })
}

const plan =
  {
    sections: [
      {
        id:
          'road-1',
        type:
          'road',
        from: {
          lat:
            45,
          lng:
            9,
        },
        to: {
          lat:
            46,
          lng:
            9,
        },
        distanceMeters:
          700_000,
        durationSeconds:
          25_000,
        geometry: {
          type:
            'LineString',
          coordinates: [
            [
              9,
              45,
            ],
            [
              9,
              46,
            ],
          ],
        },
      },
      {
        id:
          'ferry-1',
        type:
          'ferry',
        from: {
          lat:
            46,
          lng:
            9,
        },
        to: {
          lat:
            46.5,
          lng:
            9,
        },
        distanceMeters:
          150_000,
        durationSeconds:
          12_000,
        geometry: {
          type:
            'LineString',
          coordinates: [
            [
              9,
              46,
            ],
            [
              9,
              46.5,
            ],
          ],
        },
        candidate:
          {},
      },
      {
        id:
          'road-2',
        type:
          'road',
        from: {
          lat:
            46.5,
          lng:
            9,
        },
        to: {
          lat:
            47.5,
          lng:
            9,
        },
        distanceMeters:
          900_000,
        durationSeconds:
          30_000,
        geometry: {
          type:
            'LineString',
          coordinates: [
            [
              9,
              46.5,
            ],
            [
              9,
              47.5,
            ],
          ],
        },
      },
    ],

    distanceMeters:
      1_750_000,

    durationSeconds:
      67_000,

    usesFerry:
      true,
  } as TripRoutePlan

check(
  'Distanza strada esclude il traghetto',
  roadDistanceMeters(
    plan,
  ) ===
    1_600_000,
  `${roadDistanceMeters(plan) / 1000} km`,
)

const targets =
  cumulativeTargetsKm([
    700,
    500,
    400,
  ])

check(
  'Target cumulativi 700 + 500',
  targets.length ===
    2 &&
    targets[0] ===
      700 &&
    targets[1] ===
      1200,
  targets.join(
    ', ',
  ),
)

const point =
  pointAtRoadDistance(
    plan,
    1_200_000,
  )

check(
  'Punto 1200 km esiste sulla parte stradale',
  Boolean(
    point &&
    Math.abs(
      point.routeKm -
        1200,
    ) <
      0.1,
  ),
  point
    ? `${point.routeKm.toFixed(1)} km`
    : 'nessun punto',
)

const candidates =
  candidateRoadDistances(
    700,
    50,
  )

check(
  'Tolleranza ±50 propone tre distanze',
  candidates.join(
    ',',
  ) ===
    '650,700,750',
  candidates.join(
    ', ',
  ),
)

const booking =
  hotelSearchUrl(
    'booking',
    'Amburgo',
    '2027-07-25',
    '2027-07-26',
  )

check(
  'Booking riceve luogo e date',
  booking.includes(
    'Amburgo',
  ) &&
    booking.includes(
      '2027-07-25',
    ) &&
    booking.includes(
      '2027-07-26',
    ),
  booking,
)

const hotels =
  hotelSearchUrl(
    'hotels',
    'Schleswig',
    '2027-07-25',
    '2027-07-26',
  )

check(
  'Hotels.com riceve luogo e date',
  hotels.includes(
    'Schleswig',
  ) &&
    hotels.includes(
      '2027-07-25',
    ),
  hotels,
)

const root =
  document.getElementById(
    'test-root',
  )

if (!root) {
  throw new Error(
    'Elemento #test-root non trovato.',
  )
}

const passed =
  tests.filter(
    (
      item,
    ) =>
      item.ok,
  ).length

root.innerHTML = `
  <h1>MotoRoute · Divisione giornate</h1>
  <div class="summary ${passed === tests.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${tests.length} test superati
  </div>
  <div class="note">
    Verifica km stradali, esclusione traghetto, punti di divisione e link hotel senza API.
  </div>
  ${tests
    .map(
      (
        item,
      ) => `
        <div class="test-row ${item.ok ? 'ok' : 'ko'}">
          <div class="test-status">${item.ok ? 'OK' : 'KO'}</div>
          <div>
            <strong>${item.name}</strong>
            <div class="test-detail">${item.detail}</div>
          </div>
        </div>
      `,
    )
    .join('')}
`
