// One-shot integration for contextual autocomplete.
import fs from 'node:fs/promises'

const PROVIDER_PATH = new URL('../src/providers/autocompleteProvider.ts', import.meta.url)
const RANKING_PATH = new URL('../src/providers/autocompleteRanking.ts', import.meta.url)
const APP_PATH = new URL('../src/App.tsx', import.meta.url)
const TEST_PATH = new URL('../src/dev/autocomplete-ranking-test.ts', import.meta.url)

function replaceOnce(source, label, search, replacement) {
  const first = source.indexOf(search)
  if (first < 0) throw new Error(`Patch ${label}: blocco non trovato`)
  const second = source.indexOf(search, first + search.length)
  if (second >= 0) throw new Error(`Patch ${label}: blocco non univoco`)
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

function replaceFrom(source, label, sectionMarker, search, replacement) {
  const section = source.indexOf(sectionMarker)
  if (section < 0) throw new Error(`Patch ${label}: sezione non trovata`)
  const first = source.indexOf(search, section)
  if (first < 0) throw new Error(`Patch ${label}: blocco non trovato`)
  return source.slice(0, first) + replacement + source.slice(first + search.length)
}

let provider = await fs.readFile(PROVIDER_PATH, 'utf8')
if (!provider.includes('export type AutocompleteSearchContext')) {
  provider = replaceOnce(
    provider,
    'provider-context-type',
    `export type AutocompleteSuggestion =\n  SmartGeocodingResult\n`,
    `export type AutocompleteSuggestion =\n  SmartGeocodingResult\n\nexport type AutocompleteSearchContext = {\n  focus?: {\n    lat: number\n    lng: number\n  }\n}\n`,
  )

  provider = replaceOnce(
    provider,
    'provider-autocomplete-signature',
    `async function locationIqAutocomplete(\n  query: string,\n  signal?:\n    AbortSignal,\n  layers?: string,\n) {`,
    `async function locationIqAutocomplete(\n  query: string,\n  signal?:\n    AbortSignal,\n  layers?: string,\n  focus?: { lat: number; lng: number },\n) {`,
  )

  provider = replaceOnce(
    provider,
    'provider-viewbox',
    `  if (layers) {\n    params.set(\n      'layers',\n      layers,\n    )\n  }\n\n  const results =`,
    `  if (layers) {\n    params.set(\n      'layers',\n      layers,\n    )\n  }\n\n  if (focus) {\n    const latitudeSpan = 3.5\n    const longitudeSpan = 5\n\n    params.set(\n      'viewbox',\n      [\n        focus.lng - longitudeSpan,\n        focus.lat - latitudeSpan,\n        focus.lng + longitudeSpan,\n        focus.lat + latitudeSpan,\n      ].join(','),\n    )\n\n    params.set('bounded', '0')\n  }\n\n  const results =`,
  )

  provider = replaceOnce(
    provider,
    'provider-public-signature',
    `export async function autocompletePlaces(\n  query: string,\n  signal?:\n    AbortSignal,\n): Promise<`,
    `export async function autocompletePlaces(\n  query: string,\n  signal?:\n    AbortSignal,\n  context:\n    AutocompleteSearchContext = {},\n): Promise<`,
  )

  provider = replaceOnce(
    provider,
    'provider-city-first',
    `  const general =\n    await locationIqAutocomplete(\n      trimmedQuery,\n      signal,\n    )\n\n  const catalog =`,
    `  const cities =\n    await locationIqAutocomplete(\n      trimmedQuery,\n      signal,\n      'city',\n      context.focus,\n    )\n\n  const general =\n    await locationIqAutocomplete(\n      trimmedQuery,\n      signal,\n      undefined,\n      context.focus,\n    )\n\n  const catalog =`,
  )

  provider = replaceOnce(
    provider,
    'provider-city-merge',
    `    [\n      ...general,\n      ...catalog,\n    ],`,
    `    [\n      ...cities,\n      ...general,\n      ...catalog,\n    ],`,
  )

  await fs.writeFile(PROVIDER_PATH, provider)
}

let ranking = await fs.readFile(RANKING_PATH, 'utf8')
if (!ranking.includes('function distanceKm(')) {
  ranking = replaceOnce(
    ranking,
    'ranking-distance-helper',
    `function scoreSuggestion(\n  query: string,`,
    `function distanceKm(\n  a: { lat: number; lng: number },\n  b: { lat: number; lng: number },\n) {\n  const toRad = (value: number) => (value * Math.PI) / 180\n  const radius = 6371\n  const dLat = toRad(b.lat - a.lat)\n  const dLng = toRad(b.lng - a.lng)\n  const lat1 = toRad(a.lat)\n  const lat2 = toRad(b.lat)\n  const h =\n    Math.sin(dLat / 2) ** 2 +\n    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2\n  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))\n}\n\nfunction scoreSuggestion(\n  query: string,`,
  )

  ranking = replaceOnce(
    ranking,
    'ranking-score-signature',
    `  suggestion: SmartGeocodingResult,\n  sourceIndex: number,\n) {`,
    `  suggestion: SmartGeocodingResult,\n  sourceIndex: number,\n  focus?: { lat: number; lng: number },\n) {`,
  )

  ranking = replaceOnce(
    ranking,
    'ranking-focus-score',
    `  if (suggestion.kind === 'ferry-terminal') {\n    score += 90\n  }\n\n  return score`,
    `  if (suggestion.kind === 'ferry-terminal') {\n    score += 90\n  }\n\n  if (focus) {\n    score += Math.min(500, distanceKm(focus, suggestion) * 0.08)\n  }\n\n  return score`,
  )

  ranking = replaceOnce(
    ranking,
    'ranking-public-signature',
    `export function rankAutocompleteSuggestions(\n  query: string,\n  suggestions: SmartGeocodingResult[],\n) {`,
    `export function rankAutocompleteSuggestions(\n  query: string,\n  suggestions: SmartGeocodingResult[],\n  focus?: { lat: number; lng: number },\n) {`,
  )

  ranking = replaceOnce(
    ranking,
    'ranking-call-focus',
    `        suggestion,\n        sourceIndex,\n      ),`,
    `        suggestion,\n        sourceIndex,\n        focus,\n      ),`,
  )

  await fs.writeFile(RANKING_PATH, ranking)
}

let app = await fs.readFile(APP_PATH, 'utf8')
if (!app.includes('const destinationSearchFocus =')) {
  const baseSearch = `        const results =\n          await autocompletePlaces(\n            cleanQuery,\n            controller.signal,\n          )`

  app = replaceFrom(
    app,
    'app-start-focus',
    'const autocompleteStart =',
    baseSearch,
    `        const startSearchFocus =\n          destinationPlace\n            ? { lat: destinationPlace.lat, lng: destinationPlace.lng }\n            : undefined\n\n        const results =\n          await autocompletePlaces(\n            cleanQuery,\n            controller.signal,\n            { focus: startSearchFocus },\n          )`,
  )

  app = replaceFrom(
    app,
    'app-start-rank',
    'const autocompleteStart =',
    `            cleanQuery,\n            results,\n          ),`,
    `            cleanQuery,\n            results,\n            startSearchFocus,\n          ),`,
  )

  app = replaceFrom(
    app,
    'app-destination-focus',
    'const autocompleteDestination =',
    baseSearch,
    `        const destinationSearchFocus =\n          startPlace\n            ? { lat: startPlace.lat, lng: startPlace.lng }\n            : undefined\n\n        const results =\n          await autocompletePlaces(\n            cleanQuery,\n            controller.signal,\n            { focus: destinationSearchFocus },\n          )`,
  )

  app = replaceFrom(
    app,
    'app-destination-rank',
    'const autocompleteDestination =',
    `            cleanQuery,\n            results,\n          ),`,
    `            cleanQuery,\n            results,\n            destinationSearchFocus,\n          ),`,
  )

  app = replaceFrom(
    app,
    'app-intermediate-focus',
    'const autocompleteIntermediate =',
    baseSearch,
    `        const contextIndex =\n          editingExistingWaypointIndex ?? editingInsertIndex\n\n        const previousWaypoint =\n          contextIndex !== null && contextIndex > 0\n            ? waypoints[contextIndex - 1]\n            : null\n\n        const intermediateSearchFocus =\n          previousWaypoint\n            ? { lat: previousWaypoint.lat, lng: previousWaypoint.lng }\n            : startPlace\n              ? { lat: startPlace.lat, lng: startPlace.lng }\n              : undefined\n\n        const results =\n          await autocompletePlaces(\n            cleanQuery,\n            controller.signal,\n            { focus: intermediateSearchFocus },\n          )`,
  )

  app = replaceFrom(
    app,
    'app-intermediate-rank',
    'const autocompleteIntermediate =',
    `                      cleanQuery,\n                      results,\n                    ),`,
    `                      cleanQuery,\n                      results,\n                      intermediateSearchFocus,\n                    ),`,
  )

  await fs.writeFile(APP_PATH, app)
}

let test = await fs.readFile(TEST_PATH, 'utf8')
if (!test.includes('Como Italia preferito a Como USA')) {
  test = replaceOnce(
    test,
    'test-context-case',
    `  {\n    name: 'Ricerca porto mantiene il ranking specializzato esistente',`,
    `  {\n    name: 'Como Italia preferito a Como USA con partenza in Brianza',\n    run: () => {\n      const ranked = rankAutocompleteSuggestions(\n        'Como',\n        [\n          item('Como', 'city', 'place', 'place', 33.8688, -89.3356),\n          item('Como', 'city', 'place', 'place', 45.8081, 9.0852),\n        ],\n        { lat: 45.73, lng: 9.32 },\n      )\n      return ranked[0]?.lat === 45.8081\n    },\n  },\n  {\n    name: 'Ricerca porto mantiene il ranking specializzato esistente',`,
  )
  await fs.writeFile(TEST_PATH, test)
}

console.log('Autocomplete contestuale integrato')
