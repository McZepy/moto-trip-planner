import {
  fetchOsmFerriesForBoundsViaProxy,
} from '../ferries/osmFerryProxyImporter'

import {
  parseOsmDurationMinutes,
  type OsmFerryImportResult,
} from '../ferries/osmFerryImporter'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const TEST_BOUNDS = {
  south: 57.2,
  west: 7.0,
  north: 59.3,
  east: 10.8,
}

function normalize(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
}

function validPoint(
  point: {
    lat: number
    lng: number
  },
) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  )
}

function searchText(
  result: OsmFerryImportResult,
) {
  const routeText =
    result.routes
      .map(
        (route) =>
          [
            route.name,
            route.fromName,
            route.toName,
            route.operator,
            route.ref,
          ]
            .filter(Boolean)
            .join(' '),
      )
      .join(' ')

  const terminalText =
    result.terminals
      .map(
        (terminal) =>
          [
            terminal.name,
            terminal.operator,
          ]
            .filter(Boolean)
            .join(' '),
      )
      .join(' ')

  return normalize(
    `${routeText} ${terminalText}`,
  )
}

function buildTests(
  result: OsmFerryImportResult,
) {
  const allText =
    searchText(result)

  const tests:
    TestResult[] = [
      {
        name:
          'Rotte OSM importate',

        ok:
          result.routes.length > 0,

        detail:
          `${result.routes.length} rotte ferry lette da Overpass.`,
      },
      {
        name:
          'Terminal OSM importati',

        ok:
          result.terminals.length > 0,

        detail:
          `${result.terminals.length} terminal ferry letti da Overpass.`,
      },
      {
        name:
          'Coordinate rotte valide',

        ok:
          result.routes.every(
            (route) =>
              validPoint(
                route.startPoint,
              ) &&
              validPoint(
                route.endPoint,
              ),
          ),

        detail:
          'Ogni rotta importata deve avere due estremi geografici validi.',
      },
      {
        name:
          'Area Hirtshals riconosciuta',

        ok:
          allText.includes(
            'hirtshals',
          ),

        detail:
          'Nel dataset di prova deve comparire Hirtshals.',
      },
      {
        name:
          'Area Kristiansand o Larvik riconosciuta',

        ok:
          allText.includes(
            'kristiansand',
          ) ||
          allText.includes(
            'larvik',
          ),

        detail:
          'Il dataset deve includere almeno uno dei porti norvegesi del banco prova.',
      },
      {
        name:
          'Parser durata OSM',

        ok:
          parseOsmDurationMinutes(
            '3:45',
          ) === 225 &&
          parseOsmDurationMinutes(
            '45',
          ) === 45,

        detail:
          'I formati OSM H:MM e minuti devono essere convertiti correttamente.',
      },
    ]

  return tests
}

function routeRows(
  result: OsmFerryImportResult,
) {
  return result.routes
    .slice(0, 20)
    .map(
      (route) => {
        const routeEndpoints =
          [
            route.fromName,
            route.toName,
          ]
            .filter(Boolean)
            .join(' → ')

        const label =
          route.name ??
          (
            routeEndpoints ||
            `${route.osmType} ${route.osmId}`
          )

        return `
          <div class="route-row">
            <strong>${label}</strong>
            <span>
              ${route.operator ?? 'operatore n.d.'}
              · ${route.motorcycleAllowed === true ? 'moto sì' : route.motorcycleAllowed === false ? 'moto no' : 'moto n.d.'}
            </span>
          </div>
        `
      },
    )
    .join('')
}

function terminalRows(
  result: OsmFerryImportResult,
) {
  return result.terminals
    .slice(0, 20)
    .map(
      (terminal) => `
        <div class="route-row">
          <strong>${terminal.name}</strong>
          <span>
            ${terminal.point.lat.toFixed(5)},
            ${terminal.point.lng.toFixed(5)}
          </span>
        </div>
      `,
    )
    .join('')
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

async function run() {
  try {
    const result =
      await fetchOsmFerriesForBoundsViaProxy(
        TEST_BOUNDS,
      )

    const tests =
      buildTests(result)

    const passed =
      tests.filter(
        (test) =>
          test.ok,
      ).length

    root.innerHTML = `
      <h1>
        MotoRoute · OSM Ferry Importer Test
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
        Fonte LIVE: OpenStreetMap / Overpass.<br />
        Endpoint: ${result.endpoint}.<br />
        La chiamata passa dal proxy locale Vite per evitare CORS del browser.
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

      <h2>Rotte importate</h2>
      <div class="routes">
        ${routeRows(result)}
      </div>

      <h2>Terminal importati</h2>
      <div class="routes">
        ${terminalRows(result)}
      </div>
    `
  } catch (error) {
    root.innerHTML = `
      <h1>
        MotoRoute · OSM Ferry Importer Test
      </h1>

      <p class="summary ko-summary">
        ERRORE
      </p>

      <div class="test-row ko">
        <div class="test-status">
          ERROR
        </div>

        <div>
          <strong>
            Importazione OSM non riuscita
          </strong>

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
  }
}

run()
