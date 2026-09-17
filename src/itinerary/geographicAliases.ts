export type GeographicSearchKind =
  | 'locality'
  | 'road'
  | 'attraction'
  | 'bridge'

export type GeographicSearchHint = {
  query: string
  kind: GeographicSearchKind

  /*
   * Solo per località che il geocoder ha dimostrato di
   * interpretare in modo ambiguo nel viaggio reale.
   */
  fixedPoint?: {
    lat: number
    lng: number
    label: string
  }
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
    query: 'Luzern, Switzerland',
    kind: 'locality',

    fixedPoint: {
      lat: 47.0502,
      lng: 8.3093,
      label:
        'Luzern, Schweiz',
    },
  },
  basilea: {
    query: 'Basel, Switzerland',
    kind: 'locality',

    fixedPoint: {
      lat: 47.5596,
      lng: 7.5886,
      label:
        'Basel, Schweiz',
    },
  },
  francoforte: {
    query: 'Frankfurt am Main, Germany',
    kind: 'locality',

    fixedPoint: {
      lat: 50.1109,
      lng: 8.6821,
      label:
        'Frankfurt am Main, Deutschland',
    },
  },
  'francoforte sul meno': {
    query: 'Frankfurt am Main, Germany',
    kind: 'locality',

    fixedPoint: {
      lat: 50.1109,
      lng: 8.6821,
      label:
        'Frankfurt am Main, Deutschland',
    },
  },
  amburgo: {
    query: 'Hamburg, Germany',
    kind: 'locality',

    fixedPoint: {
      lat: 53.5511,
      lng: 9.9937,
      label:
        'Hamburg, Deutschland',
    },
  },
  copenaghen: {
    query: 'København, Denmark',
    kind: 'locality',

    fixedPoint: {
      lat: 55.6761,
      lng: 12.5683,
      label:
        'København, Danmark',
    },
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


export function resolveGeographicFixedPoint(
  value: string,
) {
  return resolveGeographicSearchHint(
    value,
  ).fixedPoint
}
