import {
  findFerryRoutesBetweenPorts,
  findFerryRoutesForPort,
  getFerryCatalog,
  listRoutableFerryServices,
  searchFerryPorts,
} from '../ferries/ferryCatalog'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

function uniqueIds(
  values: {
    id: string
  }[],
) {
  return (
    new Set(
      values.map(
        (value) =>
          value.id,
      ),
    ).size ===
    values.length
  )
}

function runTests() {
  const catalog =
    getFerryCatalog()

  const portIds =
    new Set(
      catalog.ports.map(
        (port) =>
          port.id,
      ),
    )

  const terminalIds =
    new Set(
      catalog.terminals.map(
        (terminal) =>
          terminal.id,
      ),
    )

  const routeIds =
    new Set(
      catalog.routes.map(
        (route) =>
          route.id,
      ),
    )

  const tests:
    TestResult[] = []

  tests.push({
    name:
      'ID catalogo univoci',

    ok:
      uniqueIds(
        catalog.ports,
      ) &&
      uniqueIds(
        catalog.terminals,
      ) &&
      uniqueIds(
        catalog.routes,
      ) &&
      uniqueIds(
        catalog.services,
      ),

    detail:
      'Porti, terminal, rotte e servizi non devono avere ID duplicati.',
  })

  tests.push({
    name:
      'Terminal collegati a porti validi',

    ok:
      catalog.terminals
        .every(
          (terminal) =>
            portIds.has(
              terminal.portId,
            ),
        ),

    detail:
      'Ogni terminal deve riferirsi a un porto esistente.',
  })

  tests.push({
    name:
      'Rotte collegate a porti validi',

    ok:
      catalog.routes
        .every(
          (route) =>
            portIds.has(
              route.portAId,
            ) &&
            portIds.has(
              route.portBId,
            ),
        ),

    detail:
      'Ogni rotta deve collegare due porti esistenti.',
  })

  tests.push({
    name:
      'Servizi collegati correttamente',

    ok:
      catalog.services
        .every(
          (service) =>
            routeIds.has(
              service.routeId,
            ) &&
            (
              !service
                .terminalAId ||
              terminalIds.has(
                service
                  .terminalAId,
              )
            ) &&
            (
              !service
                .terminalBId ||
              terminalIds.has(
                service
                  .terminalBId,
              )
            ),
        ),

    detail:
      'Le referenze di route e terminal devono essere valide.',
  })

  tests.push({
    name:
      'Hirtshals → Kristiansand presente',

    ok:
      findFerryRoutesBetweenPorts(
        'hirtshals',
        'kristiansand',
      ).length >
      0,

    detail:
      'La rotta deve essere trovata senza logica speciale.',
  })

  tests.push({
    name:
      'Hirtshals → Larvik presente',

    ok:
      findFerryRoutesBetweenPorts(
        'hirtshals',
        'larvik',
      ).length >
      0,

    detail:
      'Larvik deve essere una normale rotta del catalogo.',
  })

  tests.push({
    name:
      'Hirtshals → Bergen presente',

    ok:
      findFerryRoutesBetweenPorts(
        'hirtshals',
        'bergen',
      ).length >
      0,

    detail:
      'Bergen deve essere una normale rotta del catalogo.',
  })

  const sardiniaRouteIds =
    new Set(
      [
        ...findFerryRoutesForPort(
          'olbia',
        ),
        ...findFerryRoutesForPort(
          'porto-torres',
        ),
      ].map(
        (route) =>
          route.id,
      ),
    )

  tests.push({
    name:
      'Alternative Italia → Sardegna presenti',

    ok:
      sardiniaRouteIds.has(
        'genova-porto-torres',
      ) &&
      sardiniaRouteIds.has(
        'genova-olbia',
      ) &&
      sardiniaRouteIds.has(
        'livorno-olbia',
      ) &&
      sardiniaRouteIds.has(
        'civitavecchia-olbia',
      ) &&
      sardiniaRouteIds.has(
        'civitavecchia-porto-torres',
      ),

    detail:
      `${sardiniaRouteIds.size} rotte Sardegna individuate nel seed.`,
  })

  const hirtshalsSearch =
    searchFerryPorts(
      'Hirtshals',
    )

  tests.push({
    name:
      'Ricerca porto nel catalogo',

    ok:
      hirtshalsSearch
        .some(
          (port) =>
            port.id ===
            'hirtshals',
        ),

    detail:
      'La ricerca non dipende dal vecchio FerryProvider.',
  })

  const routable =
    listRoutableFerryServices()

  tests.push({
    name:
      'Servizi con terminal utilizzabili dal routing',

    ok:
      routable.some(
        (view) =>
          view.route.id ===
            'hirtshals-larvik',
      ) &&
      routable.some(
        (view) =>
          view.route.id ===
            'hirtshals-bergen',
      ) &&
      routable.some(
        (view) =>
          view.route.id ===
            'hirtshals-kristiansand',
      ),

    detail:
      `${routable.length} servizi dispongono già di coordinate terminal utilizzabili.`,
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
    MotoRoute · FerryCatalog Test
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
