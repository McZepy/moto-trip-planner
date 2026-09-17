import {
  evaluateFerryRouteAlternatives,
  type FerryRouteEvaluationResult,
} from '../ferries/ferryRouteEvaluator'

import type {
  RoutePoint,
} from '../providers/routingProvider'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const hirtshals:
  RoutePoint = {
  lat: 57.5925,
  lng: 9.9628,
}

const bergen:
  RoutePoint = {
  lat: 60.392,
  lng: 5.311,
}

function formatDistance(
  meters: number,
) {
  return `${(
    meters /
    1000
  ).toFixed(1)} km`
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

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours} h ${minutes} min`
}

function alternativeRows(
  result:
    FerryRouteEvaluationResult,
) {
  return result
    .alternatives
    .map(
      (alternative) => {
        const selected =
          alternative.id ===
          result.selected.id

        return `
          <div class="alternative ${
            selected
              ? 'selected'
              : ''
          }">
            <strong>
              ${
                selected
                  ? '★ '
                  : ''
              }
              ${alternative.label}
            </strong>

            <span>
              ${formatDistance(
                alternative.distanceMeters,
              )}
              ·
              ${formatDuration(
                alternative.durationSeconds,
              )}
            </span>
          </div>
        `
      },
    )
    .join('')
}

function runChecks(
  result:
    FerryRouteEvaluationResult,
) {
  const tests:
    TestResult[] = []

  const ids =
    new Set(
      result
        .alternatives
        .map(
          (alternative) =>
            alternative.id,
        ),
    )

  tests.push({
    name:
      'Percorso diretto OSRM presente',

    ok:
      ids.has(
        'direct-osrm',
      ),

    detail:
      'Il confronto deve sempre includere il percorso diretto calcolato da OSRM.',
  })

  tests.push({
    name:
      'Hirtshals → Bergen presente',

    ok:
      [...ids]
        .some(
          (id) =>
            id.includes(
              'fjord-hirtshals-bergen',
            ),
        ),

    detail:
      'Il traghetto diretto Fjord Line deve essere valutato.',
  })

  tests.push({
    name:
      'Hirtshals → Larvik presente',

    ok:
      [...ids]
        .some(
          (id) =>
            id.includes(
              'color-hirtshals-larvik',
            ),
        ),

    detail:
      'Larvik deve entrare nel confronto reale OSRM.',
  })

  tests.push({
    name:
      'Hirtshals → Kristiansand presente',

    ok:
      [...ids]
        .some(
          (id) =>
            id.includes(
              'fjord-hirtshals-kristiansand',
            ),
        ),

    detail:
      'Kristiansand deve entrare nel confronto reale OSRM.',
  })

  const minimum =
    Math.min(
      ...result
        .alternatives
        .map(
          (alternative) =>
            alternative.durationSeconds,
        ),
    )

  tests.push({
    name:
      'Selezione della più veloce',

    ok:
      result
        .selected
        .durationSeconds ===
      minimum,

    detail:
      'La selezione deve dipendere dai tempi reali OSRM + durata traghetto statica verificata.',
  })

  tests.push({
    name:
      'Segmenti strada/traghetto separati',

    ok:
      result
        .alternatives
        .filter(
          (alternative) =>
            alternative.kind ===
            'known-ferry',
        )
        .every(
          (alternative) =>
            alternative
              .sections
              .some(
                (section) =>
                  section.type ===
                  'ferry',
              ),
        ),

    detail:
      'Ogni alternativa traghetto deve conservare il segmento marittimo separato.',
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

async function runTest() {
  try {
    const result =
      await evaluateFerryRouteAlternatives(
        hirtshals,
        bergen,
        {
          includeKnownFerries:
            true,
        },
      )

    const tests =
      runChecks(
        result,
      )

    const passed =
      tests.filter(
        (test) =>
          test.ok,
      ).length

    const testRows =
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

    const rejectedRows =
      result
        .rejectedCandidates
        .map(
          (candidate) => `
            <div class="rejected">
              ${candidate.label}: ${candidate.reason}
            </div>
          `,
        )
        .join('')

    root.innerHTML = `
      <h1>
        MotoRoute · FerryRouteEvaluator Test
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

      <p class="note">
        Test LIVE: usa realmente il server pubblico OSRM.
        Il caricamento può richiedere alcuni secondi.
      </p>

      <h2>
        Alternative calcolate
      </h2>

      <div class="alternatives">
        ${alternativeRows(
          result,
        )}
      </div>

      ${
        rejectedRows
          ? `
              <h2>
                Candidate scartate
              </h2>

              ${rejectedRows}
            `
          : ''
      }

      <h2>
        Controlli
      </h2>

      ${testRows}
    `
  } catch (error) {
    root.innerHTML = `
      <h1>
        MotoRoute · FerryRouteEvaluator Test
      </h1>

      <p class="summary ko-summary">
        ERRORE
      </p>

      <div class="test-row ko">
        <div class="test-status">
          ERROR
        </div>

        <div>
          ${
            error instanceof Error
              ? error.message
              : 'Errore sconosciuto'
          }
        </div>
      </div>
    `
  }
}

runTest()
