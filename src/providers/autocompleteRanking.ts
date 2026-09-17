import type { SmartGeocodingResult } from './autocompleteProvider'

const LOCALITY_TYPES = new Set([
  'city',
  'town',
  'village',
  'municipality',
  'hamlet',
  'locality',
])

const BROAD_TYPES = new Set([
  'administrative',
  'boundary',
  'province',
  'county',
  'state',
  'region',
])

const PORT_INTENT = /\b(porto|port|ferry|traghetto|traghetti|terminal|havn|harbour|harbor)\b/iu

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreSuggestion(
  query: string,
  suggestion: SmartGeocodingResult,
  sourceIndex: number,
) {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(suggestion.name)
  const normalizedLabel = normalizeText(suggestion.label)
  const normalizedType = normalizeText(suggestion.type ?? '')
  const normalizedCategory = normalizeText(suggestion.category ?? '')

  let score = sourceIndex * 3

  if (normalizedName === normalizedQuery) {
    score -= 220
  } else if (
    normalizedName.startsWith(normalizedQuery) ||
    normalizedQuery.startsWith(normalizedName)
  ) {
    score -= 70
  } else if (normalizedLabel.startsWith(normalizedQuery)) {
    score -= 35
  }

  if (suggestion.kind === 'place') {
    score -= 90
  }

  if (LOCALITY_TYPES.has(normalizedType)) {
    score -= 140
  }

  if (normalizedCategory === 'place') {
    score -= 45
  }

  if (
    normalizedCategory === 'boundary' ||
    BROAD_TYPES.has(normalizedType)
  ) {
    score += 220
  }

  if (suggestion.kind === 'address') {
    score += 45
  }

  if (suggestion.kind === 'poi') {
    score += 70
  }

  if (suggestion.kind === 'ferry-terminal') {
    score += 90
  }

  return score
}

export function rankAutocompleteSuggestions(
  query: string,
  suggestions: SmartGeocodingResult[],
) {
  if (PORT_INTENT.test(query)) {
    return suggestions
  }

  return suggestions
    .map((suggestion, sourceIndex) => ({
      suggestion,
      score: scoreSuggestion(
        query,
        suggestion,
        sourceIndex,
      ),
    }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.suggestion)
}
