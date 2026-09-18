import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  mergeFuelAndBreakStops,
  plannedStopPoints,
} from '../itinerary/serviceStopPlanner'

import {
  roadDistanceMeters,
} from '../itinerary/routeDaySplitter'

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
          'road-main',
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
            50,
          lng:
            9,
        },
        distanceMeters:
          700_000,
        durationSeconds:
          28_000,
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
              47.5,
            ],
            [
              9,
              50,
            ],
          ],
        },
      },
    ],

    distanceMeters:
      700_000,

    durationSeconds:
      28_000,

    usesFerry:
      false,
  } as TripRoutePlan

check(
  'Distanza strada corretta',
  roadDistanceMeters(
    plan,
  ) ===
    700_000,
  `${roadDistanceMeters(plan) / 1000} km`,
)

const fuel =
  plannedStopPoints(
    plan,
    250,
    60,
  )

check(
  'Rifornimenti ogni 250 km',
  fuel.length ===
    2 &&
    Math.round(
      fuel[0].routeKm,
    ) ===
      250 &&
    Math.round(
      fuel[1].routeKm,
    ) ===
      500,
  fuel
    .map(
      (
        item,
      ) =>
        item.routeKm.toFixed(
          0,
        ),
    )
    .join(
      ', ',
    ),
)

const breaks =
  plannedStopPoints(
    plan,
    150,
    45,
  )

check(
  'Pause ogni 150 km',
  breaks.length ===
    4,
  `${breaks.length} pause`,
)

const shortPlan =
  {
    ...plan,
    sections: [
      {
        ...plan.sections[
          0
        ],
        distanceMeters:
          180_000,
      },
    ],
    distanceMeters:
      180_000,
  } as TripRoutePlan

check(
  'Nessuna sosta inutile vicino alla fine',
  plannedStopPoints(
    shortPlan,
    150,
    45,
  ).length ===
    0,
  `${plannedStopPoints(shortPlan, 150, 45).length} soste`,
)

const mergedByRoute =
  mergeFuelAndBreakStops(
    [
      {
        id:
          'fuel-route',
        kind:
          'fuel',
        dayId:
          'd1',
        dayNumber:
          1,
        routeKm:
          200,
        name:
          'Fuel',
        label:
          'Fuel',
        lat:
          46,
        lng:
          10,
        durationMinutes:
          10,
        source:
          'locationiq',
      },
      {
        id:
          'break-route',
        kind:
          'break',
        dayId:
          'd1',
        dayNumber:
          1,
        routeKm:
          214,
        name:
          'Cafe',
        label:
          'Cafe',
        lat:
          46.1,
        lng:
          10.1,
        durationMinutes:
          15,
        source:
          'locationiq',
      },
    ],
    'd1',
    20,
    12,
  )

check(
  'Unisce pausa e carburante vicini sulla rotta',
  mergedByRoute
      .stops
      .length ===
    1 &&
    mergedByRoute
      .stops[0]
      .kind ===
      'fuel' &&
    mergedByRoute
      .stops[0]
      .relaxMinutes ===
      15,
  `${mergedByRoute.mergedCount} fusione`,
)

const mergedByMap =
  mergeFuelAndBreakStops(
    [
      {
        id:
          'fuel-map',
        kind:
          'fuel',
        dayId:
          'd1',
        routeKm:
          200,
        name:
          'Fuel',
        label:
          'Fuel',
        lat:
          47.5,
        lng:
          9.75,
        durationMinutes:
          10,
        source:
          'locationiq',
      },
      {
        id:
          'break-map',
        kind:
          'break',
        dayId:
          'd1',
        routeKm:
          230,
        name:
          'Cafe',
        label:
          'Cafe',
        lat:
          47.53,
        lng:
          9.8,
        durationMinutes:
          20,
        source:
          'locationiq',
      },
    ],
    'd1',
    20,
    12,
  )

check(
  'Unisce soste molto vicine sulla mappa anche con km non identici',
  mergedByMap
      .stops
      .length ===
    1 &&
    mergedByMap
      .mergedCount ===
      1,
  `${mergedByMap.mergedCount} fusione`,
)

const separated =
  mergeFuelAndBreakStops(
    [
      {
        id:
          'fuel-far',
        kind:
          'fuel',
        dayId:
          'd1',
        routeKm:
          200,
        name:
          'Fuel',
        label:
          'Fuel',
        lat:
          45,
        lng:
          9,
        durationMinutes:
          10,
        source:
          'locationiq',
      },
      {
        id:
          'break-far',
        kind:
          'break',
        dayId:
          'd1',
        routeKm:
          270,
        name:
          'Cafe',
        label:
          'Cafe',
        lat:
          46,
        lng:
          10,
        durationMinutes:
          15,
        source:
          'locationiq',
      },
    ],
    'd1',
    20,
    12,
  )

check(
  'Non unisce soste realmente lontane',
  separated
      .stops
      .length ===
    2 &&
    separated
      .mergedCount ===
      0,
  `${separated.mergedCount} fusioni`,
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
  <h1>MotoRoute · Soste carburante e relax</h1>
  <div class="summary ${passed === tests.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${tests.length} test superati
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
