export type GeographicSearchKind =
  | 'locality'
  | 'road'
  | 'attraction'
  | 'bridge'

export type GeographicSearchHint = {
  query: string
  kind: GeographicSearchKind
}

function normalizeAliasKey(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/*
 * Alias usati solo per la ricerca/geocodifica.
 * Il testo originale dell'itinerario resta invariato nell'interfaccia.
 */
const GEOGRAPHIC_ALIASES:
  Record<string, GeographicSearchHint> = {
  lucerna: {
    query: 'Luzern',
    kind: 'locality',
  },
  basilea: {
    query: 'Basel',
    kind: 'locality',
  },
  francoforte: {
    query: 'Frankfurt am Main',
    kind: 'locality',
  },
  'francoforte sul meno': {
    query: 'Frankfurt am Main',
    kind: 'locality',
  },
  amburgo: {
    query: 'Hamburg',
    kind: 'locality',
  },
  copenaghen: {
    query: 'København',
    kind: 'locality',
  },
  'capo nord': {
    query: 'Nordkapp',
    kind: 'attraction',
  },
  nordkapp: {
    query: 'Nordkapp',
    kind: 'attraction',
  },
  trollstigen: {
    query: 'Trollstigen, Rauma, Norway',
    kind: 'road',
  },
  'atlantic road': {
    query: 'Atlanterhavsvegen, Norway',
    kind: 'road',
  },
  atlanterhavsvegen: {
    query: 'Atlanterhavsvegen, Norway',
    kind: 'road',
  },
  saltstraumen: {
    query: 'Saltstraumen, Bodø, Norway',
    kind: 'attraction',
  },
  oresund: {
    query: 'Øresundsbron',
    kind: 'bridge',
  },
  'ponte oresund': {
    query: 'Øresundsbron',
    kind: 'bridge',
  },
  øresund: {
    query: 'Øresundsbron',
    kind: 'bridge',
  },
  'ponte øresund': {
    query: 'Øresundsbron',
    kind: 'bridge',
  },
  storebaelt: {
    query: 'Storebæltsbroen',
    kind: 'bridge',
  },
  'ponte storebaelt': {
    query: 'Storebæltsbroen',
    kind: 'bridge',
  },
  storebælt: {
    query: 'Storebæltsbroen',
    kind: 'bridge',
  },
  'ponte storebælt': {
    query: 'Storebæltsbroen',
    kind: 'bridge',
  },
}

export function resolveGeographicSearchHint(
  value: string,
): GeographicSearchHint {
  const key =
    normalizeAliasKey(
      value,
    )

  return (
    GEOGRAPHIC_ALIASES[key] ?? {
      query:
        value.trim(),
      kind:
        'locality',
    }
  )
}

export function resolveGeographicSearchQuery(
  value: string,
) {
  return resolveGeographicSearchHint(
    value,
  ).query
}
