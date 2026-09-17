import {
  planFastestRouteAlternatives,
  type RouteAlternativesResult,
} from '../providers/tripRouteAlternatives'

type TestCase = {
  name: string

  start: {
    lat: number
    lng: number
  }

  destination: {
    lat: number
    lng: number
  }

  allowFerries: boolean

  validate: (
    result:
      RouteAlternativesResult,
  ) => boolean

  expected: string
}

const tests:
  TestCase[] = [
    {
      name:
        'Hirtshals → Bergen, traghetti consentiti',

      start: {
        lat: 57.5925,
        lng: 9.9628,
      },

      destination: {
        lat: 60.392,
        lng: 5.311,
      },

      allowFerries:
        true,

      validate:
        (result) => {
          const ids =
            result
              .alternatives
              .map(
                (
                  alternative,
                ) =>
                  alternative.id,
              )

          const minimum =
            Math.min(
              ...result
                .alternatives
                .map(
                  (
                    alternative,
                  ) =>
                    alternative
                      .plan
                      .durationSeconds,
                ),
            )

          return (
            ids.includes(
              'road-only',
            ) &&
            ids.includes(
              'ferry:hirtshals-bergen',
            ) &&
            ids.includes(
              'ferry:hirtshals-kristiansand',
            ) &&
            result
              .selected
              .plan
              .durationSeconds ===
              minimum
          )
        },

      expected:
        'Confronta strada + entrambe le alternative traghetto e sceglie la più veloce',
    },

    {
      name:
        'Hirtshals → Bergen, traghetti esclusi',

      start: {
        lat: 57.5925,
        lng: 9.9628,
      },

      destination: {
        lat: 60.392,
        lng: 5.311,
      },

      allowFerries:
        false,

      validate:
        (result) =>
          result
            .alternatives
            .length ===
            1 &&
          result
            .selected
            .id ===
            'road-only',

      expected:
        'Solo alternativa stradale',
    },

    {
      name:
        'Viganò → Lecco, traghetti consentiti',

      start: {
        lat: 45.724,
        lng: 9.326,
      },

      destination: {
        lat: 45.856,
        lng: 9.397,
      },

      allowFerries:
        true,

      validate:
        (result) =>
          result
            .alternatives
            .length ===
            1 &&
          result
            .selected
            .id ===
            'road-only',

      expected:
        'Solo alternativa stradale',
    },

    {
      name:
        'Aalborg → Bergen, traghetti consentiti',

      start: {
        lat: 57.0488,
        lng: 9.9217,
      },

      destination: {
        lat: 60.392,
        lng: 5.311,
      },

      allowFerries:
        true,

      validate:
        (result) => {
          const minimum =
            Math.min(
              ...result
                .alternatives
                .map(
                  (
                    alternative,
                  ) =>
                    alternative
                      .plan
                      .durationSeconds,
                ),
            )

          return (
            result
              .alternatives
              .length >=
              3 &&
            result
              .selected
              .plan
              .durationSeconds ===
              minimum
          )
        },

      expected:
        'Confronta strada e più alternative traghetto',
    },
  ]

function formatDistance(
  meters: number,
) {
  return `${
    (
      meters /
      1000
    ).toFixed(1)
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

  if (hours === 0) {
    return `${minutes} min`
  }

  return (
    `${hours} h ` +
    `${minutes} min`
  )
}

function alternativeList(
  result:
    RouteAlternativesResult,
) {
  return result
    .alternatives
    .map(
      (
        alternative,
      ) => {
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
                alternative
                  .plan
                  .distanceMeters,
              )}
              ·
              ${formatDuration(
                alternative
                  .plan
                  .durationSeconds,
              )}
            </span>
          </div>
        `
      },
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

async function runTests() {
  let passed =
    0

  const rows:
    string[] = []

  for (
    const test of tests
  ) {
    try {
      const result =
        await planFastestRouteAlternatives(
          test.start,
          test.destination,
          test.allowFerries,
        )

      const ok =
        test.validate(
          result,
        )

      if (ok) {
        passed += 1
      }

      rows.push(`
        <div class="test-row ${
          ok
            ? 'ok'
            : 'ko'
        }">
          <div class="test-status">
            ${
              ok
                ? 'PASS'
                : 'FAIL'
            }
          </div>

          <div>
            <strong>
              ${test.name}
            </strong>

            <div class="test-detail">
              Atteso:
              ${test.expected}
            </div>

            <div class="test-detail">
              Selezionata:
              ${result.selected.label}
            </div>

            <div class="alternatives">
              ${alternativeList(
                result,
              )}
            </div>
          </div>
        </div>
      `)
    } catch (error) {
      rows.push(`
        <div class="test-row ko">
          <div class="test-status">
            ERROR
          </div>

          <div>
            <strong>
              ${test.name}
            </strong>

            <div class="test-detail">
              ${
                error instanceof
                Error
                  ? error.message
                  : 'Errore sconosciuto'
              }
            </div>
          </div>
        </div>
      `)
    }
  }

  root.innerHTML = `
    <h1>
      MotoRoute · Route Alternatives Test
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
      Criterio attuale:
      <strong>Veloce</strong>.
      Gli altri stili non vengono simulati.
    </p>

    ${rows.join('')}
  `
}

runTests()
