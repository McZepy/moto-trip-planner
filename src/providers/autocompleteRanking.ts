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

function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (value: number) => (value * Math.PI) / 180
  const radius = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function scoreSuggestion(
  query: string,
  suggestion: SmartGeocodingResult,
  sourceIndex: number,
  focus?: { lat: number; lng: number },
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

  if (focus) {
    score += Math.min(500, distanceKm(focus, suggestion) * 0.08)
  }

  return score
}

export function rankAutocompleteSuggestions(
  query: string,
  suggestions: SmartGeocodingResult[],
  focus?: { lat: number; lng: number },
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
        focus,
      ),
    }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.suggestion)
}
