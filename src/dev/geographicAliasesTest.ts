import {
  resolveGeographicFixedPoint,
  resolveGeographicSearchHint,
  resolveGeographicSearchQuery,
} from '../itinerary/geographicAliases'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const tests: TestResult[] = []

function check(
  name: string,
  actual: string,
  expected: string,
) {
  tests.push({
    name,
    ok:
      actual === expected,
    detail:
      `${actual} → atteso: ${expected}`,
  })
}

check(
  'Lucerna usa il nome locale',
  resolveGeographicSearchQuery(
    'Lucerna',
  ),
  'Luzern',
)

check(
  'Basilea usa il nome locale',
  resolveGeographicSearchQuery(
    'Basilea',
  ),
  'Basel',
)

check(
  'Francoforte viene resa univoca',
  resolveGeographicSearchQuery(
    'Francoforte',
  ),
  'Frankfurt am Main',
)

check(
  'Amburgo usa il nome locale',
  resolveGeographicSearchQuery(
    'Amburgo',
  ),
  'Hamburg, Germany',
)

const hamburgPoint =
  resolveGeographicFixedPoint(
    'Amburgo',
  )

tests.push({
  name:
    'Amburgo ha coordinate fisse',

  ok:
    Boolean(
      hamburgPoint &&
      Math.abs(
        hamburgPoint.lat -
          53.5511,
      ) < 0.001 &&
      Math.abs(
        hamburgPoint.lng -
          9.9937,
      ) < 0.001,
    ),

  detail:
    hamburgPoint
      ? `${hamburgPoint.lat.toFixed(4)}, ${hamburgPoint.lng.toFixed(4)}`
      : 'coordinate mancanti',
})

check(
  'Copenaghen usa il nome locale',
  resolveGeographicSearchQuery(
    'Copenaghen',
  ),
  'København',
)

check(
  'Atlantic Road usa Atlanterhavsvegen',
  resolveGeographicSearchQuery(
    'Atlantic Road',
  ),
  'Atlanterhavsvegen, Norway',
)

check(
  'Trollstigen è classificata come strada',
  resolveGeographicSearchHint(
    'Trollstigen',
  ).kind,
  'road',
)

check(
  'Nordkapp è classificato come attrazione',
  resolveGeographicSearchHint(
    'Nordkapp',
  ).kind,
  'attraction',
)

check(
  'Ponte Øresund usa il nome ufficiale',
  resolveGeographicSearchQuery(
    'Ponte Øresund',
  ),
  'Øresundsbron',
)

check(
  'Ponte Storebælt usa il nome ufficiale',
  resolveGeographicSearchQuery(
    'Ponte Storebælt',
  ),
  'Storebæltsbroen',
)

check(
  'Località non mappata resta invariata',
  resolveGeographicSearchQuery(
    'Geiranger',
  ),
  'Geiranger',
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
  <h1>MotoRoute · Alias geografici</h1>
  <div class="summary ${passed === tests.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${tests.length} test superati
  </div>
  <div class="note">
    Gli alias cambiano soltanto la ricerca delle coordinate: il testo inserito dall'utente resta invariato.
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
