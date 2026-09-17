import {
  getFerryCatalog,
} from '../ferries/ferryCatalog'

import {
  FERRY_CATALOG_SEED,
} from '../ferries/ferryCatalogSeed'

import {
  loadAndActivateRuntimeFerryCatalog,
} from '../ferries/ferryCatalogRuntimeLoader'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const TEST_DATASET = {
  schemaVersion: 2,
  source:
    'openstreetmap-overpass',
  generatedAt:
    '2026-09-17T20:00:00.000Z',
  regions: [
    {
      id: 'test-north-sea',
      south: 55,
      west: 5,
      north: 61,
      east: 13,
    },
  ],
  elementCount: 6,
  elements: [
    {
      type: 'node',
      id: 1001,
      lat: 57.5963,
      lon: 9.9738,
      tags: {
        amenity:
          'ferry_terminal',
        name:
          'Hirtshals Ferry Terminal',
      },
    },
    {
      type: 'node',
      id: 1002,
      lat: 58.1441,
      lon: 7.9852,
      tags: {
        amenity:
          'ferry_terminal',
        name:
          'Kristiansand Ferry Terminal',
      },
    },
    {
      type: 'way',
      id: 2001,
      geometry: [
        {
          lat: 57.5963,
          lon: 9.9738,
        },
        {
          lat: 58.1441,
          lon: 7.9852,
        },
      ],
      tags: {
        route: 'ferry',
        name:
          'Hirtshals - Kristiansand',
        from: 'Hirtshals',
        to: 'Kristiansand',
        operator:
          'Fjord Line',
        motorcycle: 'yes',
        duration: '2:30',
      },
    },
    {
      type: 'node',
      id: 1003,
      lat: 57.4381,
      lon: 10.5369,
      tags: {
        amenity:
          'ferry_terminal',
        name:
          'Frederikshavn Ferry Terminal',
      },
    },
    {
      type: 'node',
      id: 1004,
      lat: 57.7040,
      lon: 11.9400,
      tags: {
        amenity:
          'ferry_terminal',
        name:
          'Göteborg Ferry Terminal',
      },
    },
    {
      type: 'way',
      id: 2002,
      geometry: [
        {
          lat: 57.4381,
          lon: 10.5369,
        },
        {
          lat: 57.7040,
          lon: 11.9400,
        },
      ],
      tags: {
        route: 'ferry',
        name:
          'Frederikshavn - Göteborg',
        from: 'Frederikshavn',
        to: 'Göteborg',
        operator:
          'Stena Line',
        motorcycle: 'yes',
        duration: '3:30',
      },
    },
  ],
}

function jsonResponse(
  value: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(value),
    {
      status,
      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}

async function runTests() {
  const success =
    await loadAndActivateRuntimeFerryCatalog({
      url:
        '/test/osm-ferries.json',
      fetcher:
        async () =>
          jsonResponse(
            TEST_DATASET,
          ),
    })

  const loadedCatalog =
    getFerryCatalog()

  const fjordService =
    loadedCatalog.services
      .find(
        (service) =>
          service.id ===
          'fjord-hirtshals-kristiansand',
      )

  const stenaService =
    loadedCatalog.services
      .find(
        (service) =>
          service.operator ===
          'Stena Line',
      )

  const tests:
    TestResult[] = [
    {
      name:
        'Dataset OSM caricato',
      ok:
        success.status ===
        'loaded',
      detail:
        success.status ===
        'loaded'
          ? `${success.build.importedRouteCount} rotte OSM importate.`
          : success.reason,
    },
    {
      name:
        'Catalogo runtime ampliato',
      ok:
        loadedCatalog.routes.length >
          FERRY_CATALOG_SEED.routes.length &&
        loadedCatalog.services.length >
          FERRY_CATALOG_SEED.services.length,
      detail:
        `${loadedCatalog.routes.length} rotte runtime contro ${FERRY_CATALOG_SEED.routes.length} nel seed.`,
    },
    {
      name:
        'Dati verificati hanno priorità',
      ok:
        fjordService
          ?.durationMinutesMin ===
          235 &&
        fjordService
          .durationMinutesMax ===
          235,
      detail:
        'La durata verificata Hirtshals-Kristiansand non deve essere sostituita dai 150 minuti OSM di prova.',
    },
    {
      name:
        'Nuova rotta OSM aggiunta',
      ok:
        Boolean(
          stenaService &&
          stenaService
            .durationMinutesMin ===
            210,
        ),
      detail:
        stenaService
          ? `${stenaService.operator}: ${stenaService.durationMinutesMin} min.`
          : 'Servizio Stena Line non trovato.',
    },
  ]

  const missing =
    await loadAndActivateRuntimeFerryCatalog({
      url:
        '/test/missing.json',
      fetcher:
        async () =>
          jsonResponse(
            {
              error: 'missing',
            },
            404,
          ),
    })

  tests.push({
    name:
      'Fallback su seed se file manca',
    ok:
      missing.status ===
        'fallback' &&
      getFerryCatalog() ===
        FERRY_CATALOG_SEED,
    detail:
      missing.status ===
      'fallback'
        ? missing.reason
        : 'Il fallback non è stato attivato.',
  })

  const malformed =
    await loadAndActivateRuntimeFerryCatalog({
      url:
        '/test/malformed.json',
      fetcher:
        async () =>
          jsonResponse({
            schemaVersion: 2,
            generatedAt:
              '2026-09-17T20:00:00.000Z',
            regions:
              TEST_DATASET.regions,
            elements: [],
          }),
    })

  tests.push({
    name:
      'Fallback su dataset inutilizzabile',
    ok:
      malformed.status ===
        'fallback' &&
      getFerryCatalog() ===
        FERRY_CATALOG_SEED,
    detail:
      malformed.status ===
      'fallback'
        ? malformed.reason
        : 'Dataset vuoto accettato per errore.',
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

async function render() {
  const tests =
    await runTests()

  const passed =
    tests.filter(
      (test) => test.ok,
    ).length

  root.innerHTML = `
    <h1>
      MotoRoute · FerryCatalog Runtime Loader Test
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
      Test isolato con fetch simulato: nessuna chiamata Overpass.<br />
      Verifica caricamento, normalizzazione, merge e fallback automatico.
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
}

render().catch((error) => {
  root.innerHTML = `
    <h1>
      MotoRoute · FerryCatalog Runtime Loader Test
    </h1>
    <p class="summary ko-summary">
      ERRORE
    </p>
    <div class="test-row ko">
      <div class="test-status">
        ERROR
      </div>
      <div>
        <strong>Test non eseguito</strong>
        <div class="test-detail">
          ${
            error instanceof Error
              ? error.message
              : 'Errore sconosciuto'
          }
        </div>
      </div>
    </div>
  `
})
