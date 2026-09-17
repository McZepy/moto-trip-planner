import {
  planMultiLegRoute,
  type MultiLegRoutePlan,
} from '../providers/multiLegTripPlanner'

type TestCase = {
  name: string

  points: Array<{
    lat: number
    lng: number
  }>

  allowFerries:
    boolean

  expected:
    string

  validate:
    (
      plan:
        MultiLegRoutePlan,
    ) => boolean
}

const HIRTSHALS = {
  lat: 57.5925,
  lng: 9.9628,
}

const KRISTIANSAND = {
  lat: 58.1467,
  lng: 8.0028,
}

const BERGEN = {
  lat: 60.392,
  lng: 5.311,
}

const VIGANO = {
  lat: 45.724,
  lng: 9.326,
}

const LECCO = {
  lat: 45.856,
  lng: 9.397,
}

const SONDRIO = {
  lat: 46.1699,
  lng: 9.8716,
}

const tests:
  TestCase[] = [
    {
      name:
        'Hirtshals → Kristiansand → Bergen',

      points: [
        HIRTSHALS,
        KRISTIANSAND,
        BERGEN,
      ],

      allowFerries:
        true,

      expected:
        '1ª tratta con traghetto, 2ª tratta stradale',

      validate:
        (plan) =>
          plan.legs.length ===
            2 &&
          plan.usesFerry &&
          plan.legs[0]
            .selectedAlternative
            .plan
            .usesFerry &&
          !plan.legs[1]
            .selectedAlternative
            .plan
            .usesFerry,
    },

    {
      name:
        'Hirtshals → Kristiansand → Bergen, traghetti esclusi',

      points: [
        HIRTSHALS,
        KRISTIANSAND,
        BERGEN,
      ],

      allowFerries:
        false,

      expected:
        'Entrambe le tratte solo strada',

      validate:
        (plan) =>
          plan.legs.length ===
            2 &&
          !plan.usesFerry &&
          plan.legs.every(
            (leg) =>
              !leg
                .selectedAlternative
                .plan
                .usesFerry,
          ),
    },

    {
      name:
        'Viganò → Lecco → Sondrio',

      points: [
        VIGANO,
        LECCO,
        SONDRIO,
      ],

      allowFerries:
        true,

      expected:
        'Due tratte stradali',

      validate:
        (plan) =>
          plan.legs.length ===
            2 &&
          !plan.usesFerry &&
          plan.sections.every(
            (section) =>
              section.type ===
              'road',
          ),
    },

    {
      name:
        'Hirtshals → Bergen senza tappa intermedia',

      points: [
        HIRTSHALS,
        BERGEN,
      ],

      allowFerries:
        true,

      expected:
        'Mantiene il comportamento V0.4C5B',

      validate:
        (plan) =>
          plan.legs.length ===
            1 &&
          plan.usesFerry &&
          plan.sections.some(
            (section) =>
              section.type ===
              'ferry',
          ),
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

function sectionLabel(
  plan:
    MultiLegRoutePlan,
) {
  return plan.sections
    .map(
      (section) =>
        section.type ===
        'ferry'
          ? 'TRAGHETTO'
          : 'STRADA',
    )
    .join(
      ' → ',
    )
}

function legSummary(
  plan:
    MultiLegRoutePlan,
) {
  return plan.legs
    .map(
      (
        leg,
      ) =>
        `Tratta ${leg.index + 1}: ${leg.selectedAlternative.label}`,
    )
    .join(
      '<br />',
    )
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
    const test
    of tests
  ) {
    try {
      const plan =
        await planMultiLegRoute(
          test.points,
          test.allowFerries,
        )

      const ok =
        test.validate(
          plan,
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
              Risultato:
              ${sectionLabel(
                plan,
              )}
            </div>

            <div class="test-detail">
              ${legSummary(
                plan,
              )}
            </div>

            <div class="test-detail">
              Totale:
              ${formatDistance(
                plan.distanceMeters,
              )}
              ·
              ${formatDuration(
                plan.durationSeconds,
              )}
            </div>
          </div>
        </div>
      `)
    } catch (
      error
    ) {
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
      MotoRoute · Multi-Leg Planner Test
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
      Ogni coppia consecutiva di punti viene
      pianificata separatamente, mantenendo
      le tappe imposte dall'utente.
    </p>

    ${rows.join('')}
  `
}

runTests()
