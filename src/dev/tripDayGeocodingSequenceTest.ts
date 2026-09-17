import {
  selectBestGeocodingSequence,
} from '../itinerary/tripDayRoutePlanner'
import type {
  SmartGeocodingResult,
} from '../providers/autocompleteProvider'

function candidate(
  name: string,
  lat: number,
  lng: number,
  kind: SmartGeocodingResult['kind'] = 'place',
  type = 'city',
): SmartGeocodingResult {
  return {
    id: `${name}:${lat}:${lng}`,
    name,
    label: name,
    lat,
    lng,
    kind,
    source: 'locationiq',
    type,
  }
}

const names = [
  'Schleswig',
  'Flensburg',
  'Kolding',
  'Aarhus',
  'Aalborg',
  'Hirtshals',
  'Kristiansand',
]

const groups: SmartGeocodingResult[][] = [
  [
    candidate(
      'Schleswig-Holstein',
      54.22,
      9.70,
      'place',
      'state',
    ),
    candidate(
      'Schleswig',
      54.52,
      9.57,
    ),
  ],
  [
    candidate(
      'Flensborggade',
      55.67,
      12.54,
      'address',
      'road',
    ),
    candidate(
      'Flensburg',
      54.78,
      9.44,
    ),
  ],
  [
    candidate(
      'Kolding',
      55.70,
      12.57,
      'poi',
      'office',
    ),
    candidate(
      'Kolding',
      55.49,
      9.47,
    ),
  ],
  [
    candidate(
      'Aarhus',
      55.68,
      12.57,
      'poi',
      'university',
    ),
    candidate(
      'Aarhus',
      56.16,
      10.21,
    ),
  ],
  [
    candidate(
      'Aalborg Universitet København',
      55.65,
      12.59,
      'poi',
      'university',
    ),
    candidate(
      'Aalborg',
      57.05,
      9.92,
    ),
  ],
  [
    candidate(
      'Hirtshals',
      57.59,
      9.96,
    ),
  ],
  [
    candidate(
      'Kristiansand',
      58.15,
      8.00,
    ),
  ],
]

const selected =
  selectBestGeocodingSequence(
    names,
    groups,
  )

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const tests: TestResult[] = []

function check(
  name: string,
  ok: boolean,
  detail: string,
) {
  tests.push({
    name,
    ok,
    detail,
  })
}

check(
  'Schleswig risolto come città',
  Math.abs(
    selected[0].lat - 54.52,
  ) < 0.01,
  selected[0].label,
)

check(
  'Kolding non viene spostata a Copenaghen',
  selected[2].lng < 10,
  `${selected[2].lat.toFixed(2)}, ${selected[2].lng.toFixed(2)}`,
)

check(
  'Aarhus non viene spostata a Copenaghen',
  selected[3].lng < 11,
  `${selected[3].lat.toFixed(2)}, ${selected[3].lng.toFixed(2)}`,
)

check(
  'Aalborg resta nello Jutland',
  selected[4].lng < 11,
  `${selected[4].lat.toFixed(2)}, ${selected[4].lng.toFixed(2)}`,
)

check(
  'Sequenza finale coerente fino a Hirtshals',
  selected[5].name === 'Hirtshals' &&
    selected[5].lat > 57.4,
  selected
    .map(
      (place) =>
        place.name,
    )
    .join(' → '),
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
  <h1>MotoRoute · Geocoding giornate</h1>
  <div class="summary ${passed === tests.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${tests.length} test superati
  </div>
  <div class="note">
    Caso sintetico del Giorno 3: alcuni omonimi/POI di Copenaghen vengono proposti prima delle città corrette.
  </div>
  ${tests
    .map(
      (test) => `
        <div class="test-row ${test.ok ? 'ok' : 'ko'}">
          <div class="test-status">${test.ok ? 'OK' : 'KO'}</div>
          <div>
            <strong>${test.name}</strong>
            <div class="test-detail">${test.detail}</div>
          </div>
        </div>
      `,
    )
    .join('')}
`
