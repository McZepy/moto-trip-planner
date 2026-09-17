import {
  getTripDayFerryLegs,
  getTripDayPlaces,
  parseItineraryText,
} from '../itinerary/itineraryTextParser'

const SAMPLE = `
1. **24/7**
Viganò → Como → Chiasso → Bellinzona → Airolo → Lucerna → Basilea → Karlsruhe → Francoforte → Fulda
2. **25/7**
Fulda → Kassel → Göttingen → Hannover → Soltau → Amburgo → Schleswig
3. **26/7**
Schleswig → Flensburg → Kolding → Aarhus → Aalborg → Hirtshals → **traghetto** → Kristiansand
4. **27/7**
Kristiansand → Evje → Valle → Hovden → Haukeligrend → Røldal
5. **28/7**
Røldal → Odda → Voss → Gudvangen → Flåm → Aurland → Lærdal → Sogndal
6. **29/7**
Sogndal → Fjærland → Stryn → Geiranger → Eidsdal → Valldal → Åndalsnes
*(via Trollstigen se aperta)*
7. **30/7**
Åndalsnes → Molde → Bud → Kristiansund → Trondheim
*(via Atlantic Road)*
8. **31/7**
Trondheim → Steinkjer → Grong → Namsskogan → Mosjøen
9. **1/8**
Mosjøen → Mo i Rana → Fauske → Saltstraumen → Bodø → **traghetto** → Moskenes
10. **2/8**
Moskenes → Reine → Hamnøy → Ramberg → Leknes → Henningsvær → Svolvær → Narvik
11. **3/8**
Narvik → Bardufoss → Nordkjosbotn → Skibotn → Storslett → Alta
12. **4/8**
Alta → Skaidi → Olderfjord → Honningsvåg → Nordkapp → Honningsvåg
13. **5/8**
Honningsvåg → Olderfjord → Lakselv → Karasjok → Karigasniemi → Inari
14. **6/8**
Inari → Ivalo → Saariselkä → Sodankylä → Rovaniemi
15. **7/8**
Rovaniemi → Kemi → Tornio → Haparanda → Luleå
16. **8/8**
Luleå → Piteå → Skellefteå → Umeå → Örnsköldsvik
17. **9/8**
Örnsköldsvik → Sundsvall → Hudiksvall → Gävle → Uppsala
18. **10/8**
Uppsala → Södertälje → Norrköping → Linköping → Jönköping
19. **11/8**
Jönköping → Ljungby → Helsingborg → Malmö → Copenaghen
*(via ponte Øresund)*
20. **12/8**
Copenaghen → Roskilde → Odense → Kolding → Flensburg → Amburgo
*(via ponte Storebælt)*
21. **13/8**
Amburgo → Hannover → Göttingen → Kassel → Francoforte
22. **14/8**
Francoforte → Karlsruhe → Basilea → Lucerna → Airolo → Bellinzona → Chiasso → Como → Viganò
`

const SEPARATOR_SAMPLE = `
1. 1/9
Milano - Como - Lugano
2. 2/9
Lugano_Bellinzona_Airolo
3. 3/9
Airolo, Lucerna, Basilea
4. 4/9
Basilea; Karlsruhe; Baden-Baden
`

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const parsed =
  parseItineraryText(SAMPLE)

const separators =
  parseItineraryText(
    SEPARATOR_SAMPLE,
  )

const tests: TestResult[] = []

function check(
  name: string,
  condition: boolean,
  detail: string,
) {
  tests.push({
    name,
    ok:
      condition,
    detail,
  })
}

check(
  'Riconosce 22 giornate',
  parsed.days.length === 22,
  `Giornate trovate: ${parsed.days.length}`,
)

const first =
  parsed.days[0]

const firstPlaces =
  first
    ? getTripDayPlaces(first)
    : []

check(
  'Giorno 1: Viganò → Fulda',
  firstPlaces[0] === 'Viganò' &&
    firstPlaces.at(-1) === 'Fulda',
  firstPlaces.join(' → '),
)

const day3 =
  parsed.days[2]

const day3Ferries =
  day3
    ? getTripDayFerryLegs(day3)
    : []

check(
  'Giorno 3: traghetto Hirtshals → Kristiansand',
  day3Ferries.length === 1 &&
    day3Ferries[0]?.from === 'Hirtshals' &&
    day3Ferries[0]?.to === 'Kristiansand',
  day3Ferries
    .map(
      (leg) =>
        `${leg.from} → ${leg.to}`,
    )
    .join(', '),
)

const day6 =
  parsed.days[5]

check(
  'Giorno 6: nota Trollstigen',
  day6?.notes.includes(
    'via Trollstigen se aperta',
  ) === true,
  day6?.notes.join(' · ') ?? 'nessuna nota',
)

const day7 =
  parsed.days[6]

check(
  'Giorno 7: nota Atlantic Road',
  day7?.notes.includes(
    'via Atlantic Road',
  ) === true,
  day7?.notes.join(' · ') ?? 'nessuna nota',
)

const day9 =
  parsed.days[8]

const day9Ferries =
  day9
    ? getTripDayFerryLegs(day9)
    : []

check(
  'Giorno 9: traghetto Bodø → Moskenes',
  day9Ferries[0]?.from === 'Bodø' &&
    day9Ferries[0]?.to === 'Moskenes',
  day9Ferries
    .map(
      (leg) =>
        `${leg.from} → ${leg.to}`,
    )
    .join(', '),
)

check(
  'Giorno 19: nota ponte Øresund',
  parsed.days[18]?.notes.includes(
    'via ponte Øresund',
  ) === true,
  parsed.days[18]?.notes.join(' · ') ?? 'nessuna nota',
)

check(
  'Giorno 20: nota ponte Storebælt',
  parsed.days[19]?.notes.includes(
    'via ponte Storebælt',
  ) === true,
  parsed.days[19]?.notes.join(' · ') ?? 'nessuna nota',
)

const separatorPlaces =
  separators.days.map(
    getTripDayPlaces,
  )

check(
  'Accetta il trattino con spazi',
  separatorPlaces[0]?.join('|') ===
    'Milano|Como|Lugano',
  separatorPlaces[0]?.join(' → ') ?? '',
)

check(
  'Accetta underscore',
  separatorPlaces[1]?.join('|') ===
    'Lugano|Bellinzona|Airolo',
  separatorPlaces[1]?.join(' → ') ?? '',
)

check(
  'Accetta virgola',
  separatorPlaces[2]?.join('|') ===
    'Airolo|Lucerna|Basilea',
  separatorPlaces[2]?.join(' → ') ?? '',
)

check(
  'Accetta punto e virgola senza spezzare Baden-Baden',
  separatorPlaces[3]?.join('|') ===
    'Basilea|Karlsruhe|Baden-Baden',
  separatorPlaces[3]?.join(' → ') ?? '',
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
    (test) => test.ok,
  ).length

root.innerHTML = `
  <h1>MotoRoute · ItineraryTextParser Test</h1>
  <div class="summary ${passed === tests.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${tests.length} test superati
  </div>
  <div class="note">
    Caso reale Capo Nord + separatori alternativi: freccia, trattino con spazi, underscore, virgola e punto e virgola.
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
  ${parsed.warnings.length > 0
    ? `<div class="note"><strong>Avvisi parser:</strong><br>${parsed.warnings.join('<br>')}</div>`
    : ''}
`
