import {
  getFerryCatalog,
  listRoutableFerryServices,
  resetFerryCatalog,
  searchFerryPorts,
  setFerryCatalog,
} from '../ferries/ferryCatalog'

import type {
  FerryCatalogData,
} from '../ferries/ferryCatalogTypes'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const TEST_CATALOG:
  FerryCatalogData = {
  ports: [
    {
      id: 'test-a',
      name: 'Porto Test A',
      countryCode: 'XX',
      countryName: 'Test',
      sources: [],
    },
    {
      id: 'test-b',
      name: 'Porto Test B',
      countryCode: 'XX',
      countryName: 'Test',
      sources: [],
    },
  ],
  terminals: [
    {
      id: 'test-terminal-a',
      portId: 'test-a',
      name: 'Terminal A',
      vehicleAccessPoint: {
        lat: 44,
        lng: 9,
      },
      sources: [],
    },
    {
      id: 'test-terminal-b',
      portId: 'test-b',
      name: 'Terminal B',
      vehicleAccessPoint: {
        lat: 45,
        lng: 10,
      },
      sources: [],
    },
  ],
  routes: [
    {
      id: 'test-route',
      portAId: 'test-a',
      portBId: 'test-b',
      bidirectional: true,
      sources: [],
    },
  ],
  services: [
    {
      id: 'test-service',
      routeId: 'test-route',
      operator: 'Test Ferry',
      terminalAId: 'test-terminal-a',
      terminalBId: 'test-terminal-b',
      motorcycleAllowed: true,
      sources: [],
    },
  ],
}

function runTests() {
  const tests:
    TestResult[] = []

  resetFerryCatalog()

  tests.push({
    name: 'Seed attivo di default',
    ok:
      searchFerryPorts('Hirtshals')
        .some(
          (port) =>
            port.id ===
            'hirtshals',
        ),
    detail:
      'Il comportamento attuale deve rimanere invariato finché non viene caricato un catalogo esterno.',
  })

  setFerryCatalog(
    TEST_CATALOG,
  )

  tests.push({
    name: 'Catalogo runtime sostituibile',
    ok:
      getFerryCatalog() ===
      TEST_CATALOG,
    detail:
      'Il catalogo attivo deve poter essere sostituito senza modificare FerryCandidateFinder.',
  })

  tests.push({
    name: 'Ricerca usa il catalogo runtime',
    ok:
      searchFerryPorts('Porto Test')
        .length ===
      2,
    detail:
      'Le funzioni pubbliche devono leggere il catalogo attivo e non il seed hardcoded.',
  })

  tests.push({
    name: 'Routing usa il catalogo runtime',
    ok:
      listRoutableFerryServices()
        .some(
          (view) =>
            view.service.id ===
            'test-service',
        ),
    detail:
      'Un servizio del catalogo runtime deve essere visibile al motore di selezione traghetti.',
  })

  resetFerryCatalog()

  tests.push({
    name: 'Reset ripristina il seed',
    ok:
      searchFerryPorts('Hirtshals')
        .some(
          (port) =>
            port.id ===
            'hirtshals',
        ) &&
      searchFerryPorts('Porto Test')
        .length ===
      0,
    detail:
      'Il fallback manuale deve restare sempre disponibile.',
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

root.innerHTML = `
  <h1>
    MotoRoute · FerryCatalog Runtime Test
  </h1>

  <p class="summary ${
    passed === tests.length
      ? 'ok-summary'
      : 'ko-summary'
  }">
    ${passed}/${tests.length}
    test superati
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
