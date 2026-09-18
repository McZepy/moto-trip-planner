import type {
  GeoBoundingBox,
  GeocodingResult,
} from './geocodingProvider'

import {
  getFerryConnections,
} from './ferryProvider'

export type AutocompleteSuggestionKind =
  | 'place'
  | 'address'
  | 'poi'
  | 'ferry-terminal'

export type PortResultGroup =
  | 'recommended'
  | 'company-terminal'
  | 'other-port'

export type SmartGeocodingResult =
  GeocodingResult & {
    kind:
      AutocompleteSuggestionKind

    source:
      | 'locationiq'
      | 'ferry-catalog'

    portGroup?:
      PortResultGroup
  }

export type AutocompleteSuggestion =
  SmartGeocodingResult

export type AutocompleteSearchContext = {
  focus?: {
    lat: number
    lng: number
  }

  /*
   * Usato dall'importazione itinerari: limita la ricerca a una
   * finestra ampia attorno alla tappa precedente per evitare
   * omonimi in altri paesi/continenti. L'autocomplete manuale
   * resta invece con preferenza geografica morbida.
   */
  boundedToFocus?: boolean
}

type LocationIqAddress = {
  name?: string

  house_number?: string
  road?: string

  neighbourhood?: string
  suburb?: string
  locality?: string
  hamlet?: string
  quarter?: string

  city?: string
  town?: string
  village?: string
  municipality?: string

  county?: string
  state?: string
  postcode?: string
  country?: string
}

type LocationIqResult = {
  place_id?: string | number

  osm_id?: string | number
  osm_type?: string

  lat: string
  lon: string

  boundingbox?: [
    string,
    string,
    string,
    string,
  ]

  class?: string
  type?: string

  name?: string

  display_name?: string
  display_place?: string
  display_address?: string

  address?: LocationIqAddress
}

const LOCATIONIQ_AUTOCOMPLETE_URL =
  'https://api.locationiq.com/v1/autocomplete'

const LOCATIONIQ_NEARBY_URL =
  'https://api.locationiq.com/v1/nearby'

const LOCATIONIQ_SEARCH_URL =
  'https://eu1.locationiq.com/v1/search'

const LOCATIONIQ_REVERSE_URL =
  'https://eu1.locationiq.com/v1/reverse'

const PORT_WORDS =
  /\b(porto|port|ferry|traghetto|traghetti|terminal|havn|harbour|harbor)\b/giu

const COMPANY_WORDS =
  /\b(gnv|tirrenia|moby|grimaldi|corsica ferries|sardinia ferries|fjord line|color line|dfds|stena line|scandlines|torghatten)\b/iu

const CRUISE_WORDS =
  /\b(msc|crociere|cruise|crociere terminal|cruise terminal)\b/iu

const GENERIC_FERRY_WORDS =
  /\b(porto passeggeri|terminal traghetti|ferry terminal|stazione marittima|traghetti|passeggeri)\b/iu

const ROAD_LIKE_WORDS =
  /^(via|viale|strada|piazza|piazzale|corso|lungomare)\b/iu

const MIN_REQUEST_GAP_MS =
  650

let lastRequestAt =
  0

const responseCache =
  new Map<
    string,
    LocationIqResult[]
  >()


const reverseResponseCache =
  new Map<
    string,
    LocationIqResult | null
  >()

function readLocationIqKey() {
  const env =
    import.meta.env as Record<
      string,
      unknown
    >

  const candidates = [
    env.VITE_LOCATIONIQ_KEY,
    env.VITE_LOCATIONIQ_API_KEY,
    env.VITE_LOCATIONIQ_TOKEN,
  ]

  const key =
    candidates.find(
      (
        value,
      ) =>
        typeof value ===
          'string' &&
        value.trim().length >
          0,
    )

  return typeof key ===
    'string'
    ? key.trim()
    : null
}

export function isLocationIqConfigured() {
  return Boolean(
    readLocationIqKey(),
  )
}

function getApiKey() {
  const key =
    readLocationIqKey()

  if (!key) {
    throw new Error(
      'LocationIQ non configurata: verifica VITE_LOCATIONIQ_KEY nel file .env e riavvia Vite.',
    )
  }

  return key
}

function sleep(
  milliseconds: number,
) {
  return new Promise<void>(
    (
      resolve,
    ) => {
      window.setTimeout(
        resolve,
        milliseconds,
      )
    },
  )
}

async function fetchLocationIq(
  url: string,
  signal?:
    AbortSignal,
  retry = true,
): Promise<
  LocationIqResult[]
> {
  const cached =
    responseCache.get(
      url,
    )

  if (cached) {
    return cached
  }

  const now =
    Date.now()

  const wait =
    Math.max(
      0,
      MIN_REQUEST_GAP_MS -
        (
          now -
          lastRequestAt
        ),
    )

  if (wait > 0) {
    await sleep(
      wait,
    )
  }

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      'Aborted',
      'AbortError',
    )
  }

  lastRequestAt =
    Date.now()

  const response =
    await fetch(
      url,
      {
        signal,

        headers: {
          Accept:
            'application/json',
        },
      },
    )

  if (
    response.status ===
    404
  ) {
    return []
  }

  if (
    response.status ===
      429 &&
    retry
  ) {
    await sleep(
      1200,
    )

    return fetchLocationIq(
      url,
      signal,
      false,
    )
  }

  if (!response.ok) {
    let detail =
      ''

    try {
      detail =
        await response.text()
    } catch {
      // Nessun dettaglio.
    }

    console.error(
      'LocationIQ error:',
      response.status,
      detail,
    )

    throw new Error(
      `LocationIQ non disponibile (${response.status}).`,
    )
  }

  const data =
    (await response.json()) as LocationIqResult[]

  responseCache.set(
    url,
    data,
  )

  return data
}

async function fetchLocationIqSingle(
  url: string,
  signal?:
    AbortSignal,
  retry = true,
): Promise<
  LocationIqResult | null
> {
  if (
    reverseResponseCache.has(
      url,
    )
  ) {
    return (
      reverseResponseCache.get(
        url,
      ) ??
      null
    )
  }

  const now =
    Date.now()

  const wait =
    Math.max(
      0,
      MIN_REQUEST_GAP_MS -
        (
          now -
          lastRequestAt
        ),
    )

  if (wait > 0) {
    await sleep(
      wait,
    )
  }

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      'Aborted',
      'AbortError',
    )
  }

  lastRequestAt =
    Date.now()

  const response =
    await fetch(
      url,
      {
        signal,

        headers: {
          Accept:
            'application/json',
        },
      },
    )

  if (
    response.status ===
    404
  ) {
    reverseResponseCache.set(
      url,
      null,
    )

    return null
  }

  if (
    response.status ===
      429 &&
    retry
  ) {
    await sleep(
      1200,
    )

    return fetchLocationIqSingle(
      url,
      signal,
      false,
    )
  }

  if (!response.ok) {
    let detail =
      ''

    try {
      detail =
        await response.text()
    } catch {
      // Nessun dettaglio.
    }

    console.error(
      'LocationIQ reverse error:',
      response.status,
      detail,
    )

    throw new Error(
      `LocationIQ reverse non disponibile (${response.status}).`,
    )
  }

  const data =
    (await response.json()) as LocationIqResult

  reverseResponseCache.set(
    url,
    data,
  )

  return data
}

function normalizeText(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .toLowerCase()
    .trim()
}

function isPortIntent(
  query: string,
) {
  PORT_WORDS.lastIndex =
    0

  return PORT_WORDS.test(
    query,
  )
}

function portPlaceQuery(
  query: string,
) {
  PORT_WORDS.lastIndex =
    0

  const cleaned =
    query
      .replace(
        PORT_WORDS,
        ' ',
      )
      .replace(
        /\b(di|del|della|dei|degli|de|of|the)\b/giu,
        ' ',
      )
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()

  return (
    cleaned ||
    query.trim()
  )
}

function displayPortPlace(
  query: string,
) {
  const cleaned =
    portPlaceQuery(
      query,
    )

  if (!cleaned) {
    return 'Porto'
  }

  return cleaned
    .split(/\s+/)
    .map(
      (
        part,
      ) =>
        part.length
          ? part[0]
              .toUpperCase() +
            part
              .slice(1)
              .toLowerCase()
          : part,
    )
    .join(' ')
}

function looksLikeExactAddress(
  query: string,
) {
  return /\d/.test(
    query,
  )
}

function buildAddressName(
  result:
    LocationIqResult,
) {
  const address =
    result.address ?? {}

  const roadWithNumber =
    [
      address.road,
      address.house_number,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

  const fallbackCity =
    address.city ??
    address.town ??
    address.village ??
    address.municipality

  return (
    result.name?.trim() ||
    result.display_place?.trim() ||
    address.name?.trim() ||
    roadWithNumber ||
    fallbackCity?.trim() ||
    result.display_name?.split(
      ',',
    )[0]?.trim() ||
    'Punto selezionato'
  )
}

function buildLabel(
  result:
    LocationIqResult,
) {
  return (
    result.display_name?.trim() ||
    result.display_address?.trim() ||
    buildAddressName(
      result,
    )
  )
}

function parseBoundingBox(
  value:
    LocationIqResult['boundingbox'],
) {
  if (
    !value ||
    value.length !==
      4
  ) {
    return undefined
  }

  const [
    south,
    north,
    west,
    east,
  ] =
    value.map(Number)

  if (
    ![
      south,
      north,
      west,
      east,
    ].every(
      Number.isFinite,
    )
  ) {
    return undefined
  }

  const box:
    GeoBoundingBox = {
      south,
      north,
      west,
      east,
    }

  return box
}

function detectKind(
  result:
    LocationIqResult,
): AutocompleteSuggestionKind {
  if (
    result.class ===
      'amenity' &&
    result.type ===
      'ferry_terminal'
  ) {
    return 'ferry-terminal'
  }

  if (
    result.class ===
      'place'
  ) {
    return 'place'
  }

  if (
    result.address
      ?.road
  ) {
    return 'address'
  }

  return 'poi'
}

function locationIqToSuggestion(
  result:
    LocationIqResult,
): AutocompleteSuggestion | null {
  const lat =
    Number(
      result.lat,
    )

  const lng =
    Number(
      result.lon,
    )

  if (
    !Number.isFinite(
      lat,
    ) ||
    !Number.isFinite(
      lng,
    )
  ) {
    return null
  }

  return {
    id:
      `locationiq:${result.osm_type ?? 'x'}:${result.osm_id ?? result.place_id ?? `${lat}:${lng}`}`,

    name:
      buildAddressName(
        result,
      ),

    label:
      buildLabel(
        result,
      ),

    lat,
    lng,

    kind:
      detectKind(
        result,
      ),

    source:
      'locationiq',

    osmType:
      result.osm_type,

    osmId:
      result.osm_id !==
      undefined &&
      Number.isFinite(
        Number(
          result.osm_id,
        ),
      )
        ? Number(
            result.osm_id,
          )
        : undefined,

    category:
      result.class,

    type:
      result.type,

    boundingBox:
      parseBoundingBox(
        result.boundingbox,
      ),
  }
}

function resultsToSuggestions(
  results:
    LocationIqResult[],
) {
  return results
    .map(
      locationIqToSuggestion,
    )
    .filter(
      (
        suggestion,
      ): suggestion is AutocompleteSuggestion =>
        suggestion !==
        null,
    )
}

async function locationIqAutocomplete(
  query: string,
  signal?:
    AbortSignal,
  layers?: string,
  focus?: { lat: number; lng: number },
  boundedToFocus = false,
) {
  const params =
    new URLSearchParams({
      key:
        getApiKey(),

      q:
        query,

      limit:
        '10',

      'accept-language':
        'it',

      normalizecity:
        '1',

      dedupe:
        '1',
    })

  if (layers) {
    params.set(
      'layers',
      layers,
    )
  }

  if (focus) {
    /*
     * Finestra volutamente ampia:
     * circa 650 km N/S e oltre 700 km E/O alle latitudini europee.
     * È abbastanza grande anche per tappe lunghe ma esclude gli
     * omonimi palesemente fuori corridoio.
     */
    const latitudeSpan =
      boundedToFocus
        ? 6
        : 3.5

    const longitudeSpan =
      boundedToFocus
        ? 9
        : 5

    params.set(
      'viewbox',
      [
        focus.lng - longitudeSpan,
        focus.lat - latitudeSpan,
        focus.lng + longitudeSpan,
        focus.lat + latitudeSpan,
      ].join(','),
    )

    params.set(
      'bounded',
      boundedToFocus
        ? '1'
        : '0',
    )
  }

  const results =
    await fetchLocationIq(
      `${LOCATIONIQ_AUTOCOMPLETE_URL}?${params.toString()}`,
      signal,
    )

  return resultsToSuggestions(
    results,
  )
}

async function locationIqAddressSearch(
  query: string,
  signal?:
    AbortSignal,
  focus?: {
    lat: number
    lng: number
  },
) {
  const params =
    new URLSearchParams({
      key:
        getApiKey(),

      q:
        query,

      format:
        'json',

      limit:
        '8',

      addressdetails:
        '1',

      normalizeaddress:
        '1',

      'accept-language':
        'it',
    })

  if (focus) {
    const latitudeSpan =
      1.5

    const longitudeSpan =
      2

    params.set(
      'viewbox',
      [
        focus.lng -
          longitudeSpan,
        focus.lat -
          latitudeSpan,
        focus.lng +
          longitudeSpan,
        focus.lat +
          latitudeSpan,
      ].join(','),
    )

    params.set(
      'bounded',
      '0',
    )
  }

  const results =
    await fetchLocationIq(
      `${LOCATIONIQ_SEARCH_URL}?${params.toString()}`,
      signal,
    )

  return resultsToSuggestions(
    results,
  )
}

async function nearbyFerryTerminals(
  lat: number,
  lng: number,
  signal?:
    AbortSignal,
) {
  const params =
    new URLSearchParams({
      key:
        getApiKey(),

      lat:
        String(lat),

      lon:
        String(lng),

      radius:
        '20000',

      tag:
        'amenity:ferry_terminal',

      limit:
        '30',

      dedupe:
        '1',
    })

  const results =
    await fetchLocationIq(
      `${LOCATIONIQ_NEARBY_URL}?${params.toString()}`,
      signal,
    )

  return resultsToSuggestions(
    results,
  )
}

function ferryCatalogSuggestions(
  query: string,
) {
  const normalizedQuery =
    normalizeText(
      portPlaceQuery(
        query,
      ),
    )

  if (
    normalizedQuery.length <
    3
  ) {
    return []
  }

  const seen =
    new Set<string>()

  const suggestions:
    AutocompleteSuggestion[] = []

  for (
    const connection
    of getFerryConnections()
  ) {
    const ports =
      [
        connection
          .departurePort,
        connection
          .arrivalPort,
      ]

    for (
      const port
      of ports
    ) {
      const normalizedName =
        normalizeText(
          port.name,
        )

      if (
        !normalizedName.includes(
          normalizedQuery,
        ) &&
        !normalizedQuery.includes(
          normalizedName,
        )
      ) {
        continue
      }

      const key =
        `${port.name}:${port.point.lat}:${port.point.lng}`

      if (
        seen.has(
          key,
        )
      ) {
        continue
      }

      seen.add(
        key,
      )

      suggestions.push({
        id:
          `ferry-catalog:${key}`,

        name:
          `Terminal traghetti ${port.name}`,

        label:
          `${port.name}, ${port.country}`,

        lat:
          port.point.lat,

        lng:
          port.point.lng,

        kind:
          'ferry-terminal',

        source:
          'ferry-catalog',
      })
    }
  }

  return suggestions
}

function dedupeSuggestions(
  suggestions:
    AutocompleteSuggestion[],
) {
  const seen =
    new Set<string>()

  return suggestions.filter(
    (
      suggestion,
    ) => {
      const key =
        `${suggestion.lat.toFixed(4)}:${suggestion.lng.toFixed(4)}`

      if (
        seen.has(
          key,
        )
      ) {
        return false
      }

      seen.add(
        key,
      )

      return true
    },
  )
}

function looksLikeCompanyTerminal(
  suggestion:
    AutocompleteSuggestion,
) {
  return COMPANY_WORDS.test(
    suggestion.name,
  )
}

function looksLikeCruiseTerminal(
  suggestion:
    AutocompleteSuggestion,
) {
  return CRUISE_WORDS.test(
    suggestion.name,
  )
}

function looksLikeGenericFerryAccess(
  suggestion:
    AutocompleteSuggestion,
) {
  return GENERIC_FERRY_WORDS.test(
    suggestion.name,
  )
}

function looksLikeRoadOnly(
  suggestion:
    AutocompleteSuggestion,
) {
  return ROAD_LIKE_WORDS.test(
    suggestion.name,
  )
}

function classifyPortResults(
  query: string,
  catalog:
    AutocompleteSuggestion[],
  nearby:
    AutocompleteSuggestion[],
  cityAnchor?:
    AutocompleteSuggestion,
) {
  const allTerminals =
    dedupeSuggestions(
      [
        ...catalog,
        ...nearby,
      ],
    )

  const genericCandidate =
    allTerminals.find(
      (
        suggestion,
      ) =>
        suggestion.source ===
        'ferry-catalog',
    ) ??
    allTerminals.find(
      (
        suggestion,
      ) =>
        looksLikeGenericFerryAccess(
          suggestion,
        ) &&
        !looksLikeCompanyTerminal(
          suggestion,
        ) &&
        !looksLikeCruiseTerminal(
          suggestion,
        ),
    )

  const recommended:
    AutocompleteSuggestion[] = []

  if (genericCandidate) {
    recommended.push({
      ...genericCandidate,

      id:
        `recommended:${genericCandidate.id}`,

      name:
        `Porto di ${displayPortPlace(query)} – Terminal Traghetti`,

      label:
        genericCandidate.label,

      portGroup:
        'recommended',
    })
  }

  const company =
    allTerminals
      .filter(
        (
          suggestion,
        ) =>
          suggestion.id !==
          genericCandidate?.id &&
          looksLikeCompanyTerminal(
            suggestion,
          ) &&
          !looksLikeCruiseTerminal(
            suggestion,
          ),
      )
      .map(
        (
          suggestion,
        ) => ({
          ...suggestion,

          portGroup:
            'company-terminal' as const,
        }),
      )

  const other =
    allTerminals
      .filter(
        (
          suggestion,
        ) =>
          suggestion.id !==
          genericCandidate?.id &&
          !looksLikeCompanyTerminal(
            suggestion,
          ) &&
          !looksLikeRoadOnly(
            suggestion,
          ),
      )
      .map(
        (
          suggestion,
        ) => ({
          ...suggestion,

          portGroup:
            'other-port' as const,
        }),
      )

  const city =
    cityAnchor
      ? [
          {
            ...cityAnchor,

            portGroup:
              'other-port' as const,
          },
        ]
      : []

  return dedupeSuggestions(
    [
      ...recommended,
      ...company,
      ...other,
      ...city,
    ],
  ).slice(
    0,
    12,
  )
}

async function portSearch(
  query: string,
  signal?:
    AbortSignal,
) {
  const placeQuery =
    portPlaceQuery(
      query,
    )

  const catalog =
    ferryCatalogSuggestions(
      query,
    )

  const cities =
    await locationIqAutocomplete(
      placeQuery,
      signal,
      'city',
    )

  const anchor =
    cities[0]

  if (!anchor) {
    const generic =
      await locationIqAutocomplete(
        placeQuery,
        signal,
      )

    return classifyPortResults(
      query,
      catalog,
      [],
      generic[0],
    )
  }

  const nearby =
    await nearbyFerryTerminals(
      anchor.lat,
      anchor.lng,
      signal,
    )

  return classifyPortResults(
    query,
    catalog,
    nearby,
    anchor,
  )
}

export async function autocompleteLocalities(
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
      context.boundedToFocus,
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
      context.boundedToFocus,
    )

  return dedupeSuggestions(
    general,
  ).slice(
    0,
    10,
  )
}

export async function searchExactPlaces(
  query: string,
  signal?:
    AbortSignal,
  focus?: {
    lat: number
    lng: number
  },
) {
  const trimmedQuery =
    query.trim()

  if (
    trimmedQuery.length <
    3
  ) {
    return []
  }

  return locationIqAddressSearch(
    trimmedQuery,
    signal,
    focus,
  )
}

export async function autocompletePlaces(
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
    3
  ) {
    return []
  }

  if (
    isPortIntent(
      trimmedQuery,
    )
  ) {
    return portSearch(
      trimmedQuery,
      signal,
    )
  }

  if (
    looksLikeExactAddress(
      trimmedQuery,
    )
  ) {
    return locationIqAddressSearch(
      trimmedQuery,
      signal,
    )
  }

  const cities =
    await locationIqAutocomplete(
      trimmedQuery,
      signal,
      'city',
      context.focus,
      context.boundedToFocus,
    )

  const catalog =
    ferryCatalogSuggestions(
      trimmedQuery,
    )

  const normalizedQuery =
    trimmedQuery
      .normalize('NFD')
      .replace(
        /[\\u0300-\\u036f]/g,
        '',
      )
      .toLowerCase()
      .trim()

  const hasStrongCityMatch =
    cities.some(
      (
        item,
      ) => {
        const normalizedName =
          item.name
            .normalize('NFD')
            .replace(
              /[\\u0300-\\u036f]/g,
              '',
            )
            .toLowerCase()
            .trim()

        return (
          normalizedName ===
            normalizedQuery ||
          normalizedName.startsWith(
            normalizedQuery,
          )
        )
      },
    )

  /*
   * Per le ricerche di località comuni evitiamo una seconda
   * chiamata LocationIQ: rende l'autocomplete molto più rapido.
   * POI/nomi non riconosciuti come città continuano con la ricerca
   * generale.
   */
  if (
    hasStrongCityMatch &&
    cities.length >
      0
  ) {
    return dedupeSuggestions(
      [
        ...cities,
        ...catalog,
      ],
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
      context.boundedToFocus,
    )

  return dedupeSuggestions(
    [
      ...cities,
      ...general,
      ...catalog,
    ],
  ).slice(
    0,
    10,
  )
}


function reverseLocality(
  address:
    LocationIqAddress,
) {
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.locality ??
    address.hamlet ??
    address.suburb ??
    address.neighbourhood ??
    address.quarter
  )
}

function reverseName(
  result:
    LocationIqResult,
  lat: number,
  lng: number,
) {
  const address =
    result.address ?? {}

  const locality =
    reverseLocality(
      address,
    )

  const road =
    address.road
      ?.trim()

  const houseNumber =
    address.house_number
      ?.trim()

  if (
    road &&
    houseNumber &&
    locality
  ) {
    return `${road} ${houseNumber}, ${locality}`
  }

  if (
    road &&
    locality
  ) {
    return `${road}, ${locality}`
  }

  const placeName =
    result.name
      ?.trim() ||
    address.name
      ?.trim()

  if (
    placeName &&
    locality &&
    normalizeText(
      placeName,
    ) !==
      normalizeText(
        locality,
      )
  ) {
    return `${placeName}, ${locality}`
  }

  if (locality) {
    return locality
  }

  return (
    `${lat.toFixed(5)}, ` +
    `${lng.toFixed(5)}`
  )
}

async function reverseLookupPointWithZoom(
  point: {
    lat: number
    lng: number
  },
  zoom: number,
  signal?:
    AbortSignal,
): Promise<
  GeocodingResult
> {
  const params =
    new URLSearchParams({
      key:
        getApiKey(),

      lat:
        String(
          point.lat,
        ),

      lon:
        String(
          point.lng,
        ),

      format:
        'json',

      addressdetails:
        '1',

      normalizeaddress:
        '1',

      normalizecity:
        '1',

      zoom:
        String(
          zoom,
        ),

      'accept-language':
        'it',
    })

  const result =
    await fetchLocationIqSingle(
      `${LOCATIONIQ_REVERSE_URL}?${params.toString()}`,
      signal,
    )

  const fallback =
    `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`

  if (!result) {
    return {
      id:
        `reverse:${point.lat}:${point.lng}`,

      name:
        fallback,

      label:
        fallback,

      lat:
        point.lat,

      lng:
        point.lng,
    }
  }

  const name =
    reverseName(
      result,
      point.lat,
      point.lng,
    )

  return {
    id:
      `reverse:${result.osm_type ?? 'x'}:${result.osm_id ?? result.place_id ?? `${point.lat}:${point.lng}`}`,

    name,

    label:
      result.display_name
        ?.trim() ||
      fallback,

    lat:
      point.lat,

    lng:
      point.lng,

    osmType:
      result.osm_type,

    osmId:
      result.osm_id !==
      undefined &&
      Number.isFinite(
        Number(
          result.osm_id,
        ),
      )
        ? Number(
            result.osm_id,
          )
        : undefined,

    category:
      result.class,

    type:
      result.type,

    boundingBox:
      parseBoundingBox(
        result.boundingbox,
      ),
  }
}

export async function reverseLookupPoint(
  point: {
    lat: number
    lng: number
  },
  signal?:
    AbortSignal,
) {
  return reverseLookupPointWithZoom(
    point,
    18,
    signal,
  )
}

export async function reverseLookupLocalityPoint(
  point: {
    lat: number
    lng: number
  },
  signal?:
    AbortSignal,
) {
  return reverseLookupPointWithZoom(
    point,
    10,
    signal,
  )
}
