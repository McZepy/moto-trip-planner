import {
  normalizeOsmFerryImport,
} from '../ferries/osmFerryCatalogNormalizer'

import type {
  OsmFerryImportResult,
} from '../ferries/osmFerryImporter'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const input:
  OsmFerryImportResult = {
  source:
    'openstreetmap-overpass',
  endpoint:
    'test',
  fetchedAt:
    '2026-09-17T18:00:00.000Z',
  bounds: {
    south: 57,
    west: 7,
    north: 60,
    east: 11,
  },
  terminals: [
    {
      osmType: 'node',
      osmId: 1001,
      name:
        'Hirtshals Ferry Terminal',
      operator:
        'Color Line',
      point: {
        lat: 57.5923,
        lng: 9.9667,
      },
    },
    {
      osmType: 'node',
      osmId: 1002,
      name:
        'Larvik Ferry Terminal',
      operator:
        'Color Line',
      point: {
        lat: 59.04,
        lng: 10.0489,
      },
    },
  ],
  routes: [
    {
      osmType: 'way',
      osmId: 2001,
      name:
        'Hirtshals - Larvik',
      operator:
        'Color Line',
      fromName:
        'Hirtshals',
      toName:
        'Larvik',
      startPoint: {
        lat: 57.5924,
        lng: 9.9668,
      },
      endPoint: {
        lat: 59.0401,
        lng: 10.049,
      },
      motorcycleAllowed:
        true,
      durationMinutes:
        225,
      tags: {
        route: 'ferry',
        motorcycle: 'yes',
        duration: '3:45',
      },
    },
    {
      osmType: 'relation',
      osmId: 2002,
      name:
        'Hirtshals - Bergen',
      operator:
        'Fjord Line',
      startPoint: {
        lat: 57.5963,
        lng: 9.9738,
      },
      endPoint: {
        lat: 60.3921,
        lng: 5.312,
      },
      tags: {
        route: 'ferry',
      },
    },
  ],
}

function runTests() {
  const result =
    normalizeOsmFerryImport(
      input,
    )

  const catalog =
    result.catalog

  const tests:
    TestResult[] = []

  tests.push({
    name:
      'Due rotte normalizzate',
    ok:
      catalog.routes.length ===
        2 &&
      catalog.services.length ===
        2,
    detail:
      `${catalog.routes.length} rotte e ${catalog.services.length} servizi prodotti.`,
  })

  tests.push({
    name:
      'Terminal OSM agganciati',
    ok:
      result.stats
        .matchedTerminals >=
        2,
    detail:
      `${result.stats.matchedTerminals} terminal reali agganciati.`,
  })

  tests.push({
    name:
      'Terminal sintetico per Bergen',
    ok:
      result.stats
        .syntheticTerminals >=
        1,
    detail:
      `${result.stats.syntheticTerminals} terminal sintetici creati quando OSM non fornisce un terminal vicino.`,
  })

  const larvikService =
    catalog.services.find(
      (service) =>
        service.id ===
        'osm-service-way-2001',
    )

  tests.push({
    name:
      'Moto e durata conservate',
    ok:
      larvikService
        ?.motorcycleAllowed ===
        true &&
      larvikService
        .durationMinutesMin ===
        225 &&
      larvikService
        .durationMinutesMax ===
        225,
    detail:
      'I dati OSM utili al routing non devono andare persi.',
  })

  const larvikRoute =
    catalog.routes.find(
      (route) =>
        route.id ===
        'osm-route-way-2001',
    )

  tests.push({
    name:
      'Distanza geografica calcolata',
    ok:
      Boolean(
        larvikRoute
          ?.distanceKm &&
        larvikRoute
          .distanceKm >
          100,
      ),
    detail:
      `${larvikRoute?.distanceKm?.toFixed(1) ?? 'n.d.'} km tra gli estremi OSM.`,
  })

  tests.push({
    name:
      'ID catalogo univoci',
    ok:
      new Set(
        catalog.ports.map(
          (port) => port.id,
        ),
      ).size ===
        catalog.ports.length &&
      new Set(
        catalog.terminals.map(
          (terminal) =>
            terminal.id,
        ),
      ).size ===
        catalog.terminals.length &&
      new Set(
        catalog.routes.map(
          (route) => route.id,
        ),
      ).size ===
        catalog.routes.length &&
      new Set(
        catalog.services.map(
          (service) =>
            service.id,
        ),
      ).size ===
        catalog.services.length,
    detail:
      'Porti, terminal, rotte e servizi devono avere ID deterministici e non duplicati.',
  })

  return {
    tests,
    result,
  }
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

const {
  tests,
  result,
} = runTests()

const passed =
  tests.filter(
    (test) => test.ok,
  ).length

root.innerHTML = `
  <h1>
    MotoRoute · OSM Ferry Normalizer Test
  </h1>

  <p class="summary ${
    passed === tests.length
      ? 'ok-summary'
      : 'ko-summary'
  }">
    ${passed}/${tests.length}
    test superati
  </p>

  <p class="note">
    Input sintetico isolato: nessuna chiamata Internet.<br />
    Output: ${result.stats.ports} porti,
    ${result.stats.terminals} terminal,
    ${result.stats.routes} rotte,
    ${result.stats.services} servizi.
  </p>

  ${tests
    .map(
      (test) => `
        <div class="test-row ${test.ok ? 'ok' : 'ko'}">
          <div class="test-status">
            ${test.ok ? 'PASS' : 'FAIL'}
          </div>
          <div>
            <strong>${test.name}</strong>
            <div class="test-detail">
              ${test.detail}
            </div>
          </div>
        </div>
      `,
    )
    .join('')}
`
