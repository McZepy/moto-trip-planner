import fs from 'node:fs/promises'

const AUTOCOMPLETE_PATH = new URL('../src/providers/autocompleteProvider.ts', import.meta.url)
const DAY_PATH = new URL('../src/itinerary/tripDayRoutePlanner.ts', import.meta.url)
const TOMTOM_PATH = new URL('../src/providers/tomTomRoutingProvider.ts', import.meta.url)
const TOMTOM_TEST_PATH = new URL('../src/dev/tomtom-routing-test.ts', import.meta.url)

function replaceOnce(source, label, search, replacement) {
  const first = source.indexOf(search)
  if (first < 0) throw new Error(`Patch ${label}: blocco non trovato`)
  const second = source.indexOf(search, first + search.length)
  if (second >= 0) throw new Error(`Patch ${label}: blocco non univoco`)
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

// 1. Ricerca dedicata alle località degli itinerari: city-first, fallback generico.
// Riduce le chiamate LocationIQ rispetto all'autocomplete UI e usa il focus geografico.
let autocomplete = await fs.readFile(AUTOCOMPLETE_PATH, 'utf8')
if (!autocomplete.includes('export async function autocompleteLocalities(')) {
  autocomplete = replaceOnce(
    autocomplete,
    'autocomplete-localities',
    `export async function autocompletePlaces(
  query: string,`,
    `export async function autocompleteLocalities(
  query: string,
  signal?:
    AbortSignal,
  context:
    AutocompleteSearchContext = {},
): Promise<
  AutocompleteSuggestion[]
> {
  const trimmedQuery =
    query.trim()

  if (
    trimmedQuery.length <
    2
  ) {
    return []
  }

  const cities =
    await locationIqAutocomplete(
      trimmedQuery,
      signal,
      'city',
      context.focus,
    )

  if (cities.length > 0) {
    return dedupeSuggestions(
      cities,
    ).slice(
      0,
      10,
    )
  }

  const general =
    await locationIqAutocomplete(
      trimmedQuery,
      signal,
      undefined,
      context.focus,
    )

  return dedupeSuggestions(
    general,
  ).slice(
    0,
    10,
  )
}

export async function autocompletePlaces(
  query: string,`,
  )

  await fs.writeFile(AUTOCOMPLETE_PATH, autocomplete)
}

// 2. Le giornate importate risolvono le località nello stesso modo dell'editor manuale:
// ogni località usa come focus quella precedente e lo stesso ranking della UI.
let day = await fs.readFile(DAY_PATH, 'utf8')
if (!day.includes("autocompleteLocalities,")) {
  day = replaceOnce(
    day,
    'day-import-localities',
    `import {
  autocompletePlaces,
  type SmartGeocodingResult,
} from '../providers/autocompleteProvider'`,
    `import {
  autocompleteLocalities,
  type SmartGeocodingResult,
} from '../providers/autocompleteProvider'
import {
  rankAutocompleteSuggestions,
} from '../providers/autocompleteRanking'`,
  )

  day = replaceOnce(
    day,
    'day-load-candidates',
    `async function loadCandidates(
  name: string,
): Promise<SmartGeocodingResult[]> {
  const key =
    normalizeText(name)

  const cached =
    candidateCache.get(key)

  if (cached) {
    return cached
  }

  const results =
    await autocompletePlaces(name)

  if (
    results.length === 0
  ) {
    throw new Error(
      \`Località non trovata: \${name}\`,
    )
  }

  candidateCache.set(
    key,
    results,
  )

  return results
}`,
    `async function loadCandidates(
  name: string,
  focus?: {
    lat: number
    lng: number
  },
): Promise<SmartGeocodingResult[]> {
  const focusKey =
    focus
      ? \`${focus.lat.toFixed(2)},${focus.lng.toFixed(2)}\`
      : 'global'

  const key =
    \`${normalizeText(name)}|${focusKey}\`

  const cached =
    candidateCache.get(key)

  if (cached) {
    return cached
  }

  const results =
    await autocompleteLocalities(
      name,
      undefined,
      { focus },
    )

  if (
    results.length === 0
  ) {
    throw new Error(
      \`Località non trovata: \${name}\`,
    )
  }

  candidateCache.set(
    key,
    results,
  )

  return results
}`,
  )

  day = replaceOnce(
    day,
    'day-resolve-places',
    `async function resolvePlaces(
  names: string[],
  anchor?: GeocodingResult,
) {
  const candidateGroups:
    SmartGeocodingResult[][] = []

  for (const name of names) {
    candidateGroups.push(
      await loadCandidates(name),
    )
  }

  return selectBestGeocodingSequence(
    names,
    candidateGroups,
    anchor,
  )
}`,
    `async function resolvePlaces(
  names: string[],
  anchor?: GeocodingResult,
) {
  const resolved:
    GeocodingResult[] = []

  let focus:
    GeocodingResult | undefined =
      anchor

  for (const name of names) {
    const candidates =
      await loadCandidates(
        name,
        focus,
      )

    const ranked =
      rankAutocompleteSuggestions(
        name,
        candidates,
        focus,
      )

    const selected =
      ranked[0]

    if (!selected) {
      throw new Error(
        \`Località non trovata: \${name}\`,
      )
    }

    const place =
      toGeocodingResult(
        selected,
      )

    resolved.push(
      place,
    )

    focus =
      place
  }

  return resolved
}`,
  )

  await fs.writeFile(DAY_PATH, day)
}

// 3. TomTom può usare i traghetti locali quando l'utente li consente.
// I traghetti espliciti nel testo continuano a essere selezionati dal FerryCatalog.
let tomtom = await fs.readFile(TOMTOM_PATH, 'utf8')
if (tomtom.includes(`const avoids:
    string[] = [
      // I traghetti restano responsabilità del FerryCatalog MotoRoute.
      // In questo modo il motore stradale non inserisce traghetti nascosti.
      'ferries',
    ]`)) {
  tomtom = replaceOnce(
    tomtom,
    'tomtom-local-ferries',
    `  const avoids:
    string[] = [
      // I traghetti restano responsabilità del FerryCatalog MotoRoute.
      // In questo modo il motore stradale non inserisce traghetti nascosti.
      'ferries',
    ]

  if (
    preferences.avoidUnpaved
  ) {`,
    `  const avoids:
    string[] = []

  if (
    !preferences.allowFerries
  ) {
    avoids.push(
      'ferries',
    )
  }

  if (
    preferences.avoidUnpaved
  ) {`,
  )

  await fs.writeFile(TOMTOM_PATH, tomtom)
}

// 4. Aggiorna il test TomTom alla nuova politica traghetti.
let test = await fs.readFile(TOMTOM_TEST_PATH, 'utf8')
if (test.includes('Routing stradale forza sempre evita traghetti')) {
  test = replaceOnce(
    test,
    'tomtom-test-avoids',
    `  check(
    'Preferenze tradotte in ferries/unpaved/motorways/tollRoads',
    [
      'ferries',
      'unpavedRoads',
      'motorways',
      'tollRoads',
    ].every(
      (item) =>
        avoids.includes(item),
    ),
    avoids.join(', '),
  )`,
    `  check(
    'Preferenze tradotte in unpaved/motorways/tollRoads',
    [
      'unpavedRoads',
      'motorways',
      'tollRoads',
    ].every(
      (item) =>
        avoids.includes(item),
    ) &&
      !avoids.includes(
        'ferries',
      ),
    avoids.join(', '),
  )`,
  )

  test = replaceOnce(
    test,
    'tomtom-test-ferries',
    `  check(
    'Routing stradale forza sempre evita traghetti',
    settings.avoids.includes(
      'ferries',
    ),
    settings.avoids.join(', '),
  )`,
    `  check(
    'Traghetti locali consentiti quando attivi',
    !settings.avoids.includes(
      'ferries',
    ),
    settings.avoids.join(', '),
  )

  const noFerrySettings =
    buildTomTomRoutingParameters({
      routeStyle:
        'fast',
      roadPreferences: {
        ...preferences,
        allowFerries:
          false,
      },
    })

  check(
    'Evita traghetti viene applicato quando disattivati',
    noFerrySettings.avoids.includes(
      'ferries',
    ),
    noFerrySettings.avoids.join(', '),
  )`,
  )

  await fs.writeFile(TOMTOM_TEST_PATH, test)
}

console.log('Routing giornate importate e traghetti locali aggiornati')

// trigger workflow
