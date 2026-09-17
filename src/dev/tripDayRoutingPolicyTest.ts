import {
  parseItineraryText,
} from '../itinerary/itineraryTextParser'
import {
  getTripDayRoutingLegs,
} from '../itinerary/tripDayRoutePlanner'

const SAMPLE = `
1. 24/7
Viganò → Como → Chiasso → Bellinzona → Airolo → Lucerna → Basilea → Karlsruhe → Francoforte → Fulda
2. 26/7
Schleswig → Flensburg → Kolding → Aarhus → Aalborg → Hirtshals → traghetto → Kristiansand
3. 1/8
Mosjøen → Mo i Rana → Fauske → Saltstraumen → Bodø → traghetto → Moskenes
`

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const parsed =
  parseItineraryText(
    SAMPLE,
  )

const tests:
  TestResult[] = []

function check(
  name: string,
  condition: boolean,
  detail: string,
) {
  tests.push({
    name,
    ok: condition,
    detail,
  })
}

const day1 =
  parsed.days[0]

const day2 =
  parsed.days[1]

const day3 =
  parsed.days[2]

const day1Legs =
  day1
    ? getTripDayRoutingLegs(day1)
    : []

const day2Legs =
  day2
    ? getTripDayRoutingLegs(day2)
    : []

const day3Legs =
  day3
    ? getTripDayRoutingLegs(day3)
    : []

check(
  'Giorno 1: nessun traghetto automatico',
  day1Legs.every(
    (leg) =>
      !leg.explicitFerry,
  ),
  day1Legs
    .map(
      (leg) =>
        `${leg.from} → ${leg.to}${leg.explicitFerry ? ' [FERRY]' : ''}`,
    )
    .join(' · '),
)

check(
  'Giorno Hirtshals: 6 tratti totali',
  day2Legs.length === 6,
  `Tratti: ${day2Legs.length}`,
)

const day2FerryLegs =
  day2Legs.filter(
    (leg) =>
      leg.explicitFerry,
  )

check(
  'Solo Hirtshals → Kristiansand è traghetto',
  day2FerryLegs.length === 1 &&
    day2FerryLegs[0]?.from ===
      'Hirtshals' &&
    day2FerryLegs[0]?.to ===
      'Kristiansand',
  day2FerryLegs
    .map(
      (leg) =>
        `${leg.from} → ${leg.to}`,
    )
    .join(' · '),
)

const roadBeforeHirtshals =
  day2Legs.slice(0, -1)

check(
  'Tutti i tratti prima di Hirtshals restano stradali',
  roadBeforeHirtshals.every(
    (leg) =>
      !leg.explicitFerry,
  ),
  roadBeforeHirtshals
    .map(
      (leg) =>
        `${leg.from} → ${leg.to}`,
    )
    .join(' · '),
)

const day3FerryLegs =
  day3Legs.filter(
    (leg) =>
      leg.explicitFerry,
  )

check(
  'Bodø → Moskenes è l’unico traghetto del giorno',
  day3FerryLegs.length === 1 &&
    day3FerryLegs[0]?.from ===
      'Bodø' &&
    day3FerryLegs[0]?.to ===
      'Moskenes',
  day3FerryLegs
    .map(
      (leg) =>
        `${leg.from} → ${leg.to}`,
    )
    .join(' · '),
)

const root =
  document.getElementById(
    'test-root',
  )

if (!root) {
  throw new Error(
    'Elemento #test-root non trovato.',
  )
}

const passed =
  tests.filter(
    (test) =>
      test.ok,
  ).length

root.innerHTML = `
  <h1>MotoRoute · Trip Day Routing Policy Test</h1>
  <div class="summary ${passed === tests.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${tests.length} test superati
  </div>
  <div class="note">
    Verifica che nelle giornate importate i traghetti vengano abilitati soltanto sul tratto esplicitamente indicato nel testo.
  </div>
  ${tests
    .map(
      (test) => `
        <div class="test-row ${test.ok ? 'ok' : 'ko'}">
          <div class="test-status">
            ${test.ok ? 'OK' : 'KO'}
          </div>
          <div>
            <strong>${test.name}</strong>
            <div class="test-detail">${test.detail}</div>
          </div>
        </div>
      `,
    )
    .join('')}
`
