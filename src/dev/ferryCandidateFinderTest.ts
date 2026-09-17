import {
  findFerryCandidates,
} from '../ferries/ferryCandidateFinder'

import type {
  RoutePoint,
} from '../providers/routingProvider'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const vigano:
  RoutePoint = {
  lat: 45.724,
  lng: 9.324,
}

const bergen:
  RoutePoint = {
  lat: 60.392,
  lng: 5.312,
}

const hirtshals:
  RoutePoint = {
  lat: 57.596,
  lng: 9.974,
}

const kristiansand:
  RoutePoint = {
  lat: 58.144,
  lng: 7.985,
}

function candidateRoutes(
  start: RoutePoint,
  destination: RoutePoint,
) {
  return findFerryCandidates(
    start,
    destination,
  ).map(
    (candidate) =>
      candidate
        .serviceView
        .route
        .id,
  )
}

function runTests() {
  const tests:
    TestResult[] = []

  const italyToBergen =
    findFerryCandidates(
      vigano,
      bergen,
    )

  const italyToBergenRoutes =
    new Set(
      italyToBergen.map(
        (candidate) =>
          candidate
            .serviceView
            .route
            .id,
      ),
    )

  tests.push({
    name:
      'Viganò → Bergen trova Hirtshals',

    ok:
      italyToBergen
        .some(
          (candidate) =>
            candidate
              .departurePortName ===
              'Hirtshals',
        ),

    detail:
      `${italyToBergen.length} candidati individuati senza limite fisso di 350 km.`,
  })

  tests.push({
    name:
      'Hirtshals → Bergen diretto presente',

    ok:
      italyToBergenRoutes.has(
        'hirtshals-bergen',
      ),

    detail:
      'Il traghetto diretto deve essere tra le alternative plausibili.',
  })

  tests.push({
    name:
      'Hirtshals → Larvik presente',

    ok:
      italyToBergenRoutes.has(
        'hirtshals-larvik',
      ),

    detail:
      'Larvik deve poter competere con le altre traversate.',
  })

  tests.push({
    name:
      'Hirtshals → Kristiansand presente',

    ok:
      italyToBergenRoutes.has(
        'hirtshals-kristiansand',
      ),

    detail:
      'Kristiansand deve restare una alternativa plausibile.',
  })

  const norwayCandidates =
    findFerryCandidates(
      hirtshals,
      bergen,
    )

  tests.push({
    name:
      'Hirtshals → Bergen produce candidati',

    ok:
      norwayCandidates.length >
      0,

    detail:
      `${norwayCandidates.length} alternative marittime trovate.`,
  })

  const kristiansandToHirtshals =
    candidateRoutes(
      kristiansand,
      hirtshals,
    )

  tests.push({
    name:
      'Direzione inversa supportata',

    ok:
      kristiansandToHirtshals
        .includes(
          'hirtshals-kristiansand',
        ),

    detail:
      'Una rotta bidirezionale deve funzionare anche Norvegia → Danimarca.',
  })

  tests.push({
    name:
      'Nessuna dipendenza dal limite 350 km',

    ok:
      italyToBergen
        .some(
          (candidate) =>
            candidate
              .distanceToDepartureKm >
            350,
        ),

    detail:
      'Almeno un porto valido deve poter trovarsi oltre 350 km dalla partenza.',
  })

  tests.push({
    name:
      'Solo candidati che avanzano verso la meta',

    ok:
      italyToBergen
        .every(
          (candidate) =>
            candidate
              .progressKm >
            0,
        ),

    detail:
      'Le direzioni che allontanano dalla destinazione devono essere scartate.',
  })

  return tests
}

const root =
  document.querySelector<HTMLDivElement>(
    '#test-root',
  )

if (!root) {
  throw new Error(
    'Contenitore test non trovato.',
  )
}

const tests =
  runTests()

const passed =
  tests.filter(
    (test) =>
      test.ok,
  ).length

const rows =
  tests
    .map(
      (test) => `
        <div class="test-row ${
          test.ok
            ? 'ok'
            : 'ko'
        }">
          <div class="test-status">
            ${
              test.ok
                ? 'PASS'
                : 'FAIL'
            }
          </div>

          <div>
            <strong>
              ${test.name}
            </strong>

            <div class="test-detail">
              ${test.detail}
            </div>
          </div>
        </div>
      `,
    )
    .join('')

root.innerHTML = `
  <h1>
    MotoRoute · FerryCandidateFinder Test
  </h1>

  <p class="summary ${
    passed ===
    tests.length
      ? 'ok-summary'
      : 'ko-summary'
  }">
    ${passed}/${tests.length}
    test superati
  </p>

  ${rows}
`
