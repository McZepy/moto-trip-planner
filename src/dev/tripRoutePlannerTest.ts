import {
  planTripRoute,
  type TripRoutePlan,
} from '../providers/tripRoutePlanner'

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
    plan: TripRoutePlan,
  ) => boolean

  expected: string
}

const tests: TestCase[] = [
  {
    name:
      'Hirtshals porto → Bergen porto',

    start: {
      lat: 57.5925,
      lng: 9.9628,
    },

    destination: {
      lat: 60.392,
      lng: 5.311,
    },

    allowFerries: true,

    validate:
      (plan) =>
        plan.usesFerry &&
        plan.sections.length ===
          1 &&
        plan.sections[0]
          .type ===
          'ferry',

    expected:
      'TRAGHETTO',
  },

  {
    name:
      'Aalborg → Bergen porto',

    start: {
      lat: 57.0488,
      lng: 9.9217,
    },

    destination: {
      lat: 60.392,
      lng: 5.311,
    },

    allowFerries: true,

    validate:
      (plan) =>
        plan.usesFerry &&
        plan.sections.length ===
          2 &&
        plan.sections[0]
          .type ===
          'road' &&
        plan.sections[1]
          .type ===
          'ferry',

    expected:
      'STRADA → TRAGHETTO',
  },

  {
    name:
      'Hirtshals porto → Oslo',

    start: {
      lat: 57.5925,
      lng: 9.9628,
    },

    destination: {
      lat: 59.9139,
      lng: 10.7522,
    },

    allowFerries: true,

    validate:
      (plan) =>
        plan.usesFerry &&
        plan.sections.length ===
          2 &&
        plan.sections[0]
          .type ===
          'ferry' &&
        plan.sections[1]
          .type ===
          'road',

    expected:
      'TRAGHETTO → STRADA',
  },

  {
    name:
      'Viganò → Lecco',

    start: {
      lat: 45.724,
      lng: 9.326,
    },

    destination: {
      lat: 45.856,
      lng: 9.397,
    },

    allowFerries: true,

    validate:
      (plan) =>
        !plan.usesFerry &&
        plan.sections.length ===
          1 &&
        plan.sections[0]
          .type ===
          'road',

    expected:
      'STRADA',
  },

  {
    name:
      'Hirtshals porto → Bergen porto, traghetti esclusi',

    start: {
      lat: 57.5925,
      lng: 9.9628,
    },

    destination: {
      lat: 60.392,
      lng: 5.311,
    },

    allowFerries: false,

    validate:
      (plan) =>
        !plan.usesFerry &&
        plan.sections.length ===
          1 &&
        plan.sections[0]
          .type ===
          'road',

    expected:
      'STRADA',
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
  plan: TripRoutePlan,
) {
  return plan.sections
    .map(
      (section) =>
        section.type ===
        'ferry'
          ? 'TRAGHETTO'
          : 'STRADA',
    )
    .join(' → ')
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
      const plan =
        await planTripRoute(
          test.start,
          test.destination,
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
              ${sectionLabel(plan)}
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
      MotoRoute · TripRoutePlanner Test
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

    ${rows.join('')}
  `
}

runTests()
