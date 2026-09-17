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
              'ferry:fjord-hirtshals-bergen',
            ) &&
            ids.includes(
              'ferry:color-hirtshals-larvik',
            ) &&
            ids.includes(
              'ferry:fjord-hirtshals-kristiansand',
            ) &&
            result
              .selected
              .plan
              .durationSeconds ===
              minimum
          )
        },

      expected:
        'Confronta OSRM + Bergen + Larvik + Kristiansand e sceglie la più veloce',
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
        'Solo percorso diretto OSRM',
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
            result
              .alternatives
              .length >=
              4 &&
            ids.includes(
              'ferry:color-hirtshals-larvik',
            ) &&
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

    {
      name:
        'Viganò → Bergen supera il vecchio limite 350 km',

      start: {
        lat: 45.724,
        lng: 9.326,
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

          return (
            ids.includes(
              'ferry:fjord-hirtshals-bergen',
            ) &&
            ids.includes(
              'ferry:color-hirtshals-larvik',
            ) &&
            ids.includes(
              'ferry:fjord-hirtshals-kristiansand',
            )
          )
        },

      expected:
        'Il routing applicativo trova Hirtshals anche da oltre 350 km',
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
      Motore attivo:
      <strong>FerryCatalog + FerryCandidateFinder + OSRM evaluator</strong>.
    </p>

    ${rows.join('')}
  `
}

runTests()
