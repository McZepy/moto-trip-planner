import type {
  FerryGeoPoint,
} from './ferryCatalogTypes'

export type OsmFerryBounds = {
  south: number
  west: number
  north: number
  east: number
}

export type OsmImportedFerryTerminal = {
  osmType:
    | 'node'
    | 'way'
    | 'relation'

  osmId: number
  name: string
  operator?: string
  point: FerryGeoPoint
}

export type OsmImportedFerryRoute = {
  osmType:
    | 'way'
    | 'relation'

  osmId: number

  name?: string
  ref?: string
  operator?: string

  fromName?: string
  toName?: string

  startPoint:
    FerryGeoPoint

  endPoint:
    FerryGeoPoint

  motorcycleAllowed?:
    boolean

  durationMinutes?:
    number

  tags:
    Record<string, string>
}

export type OsmFerryImportResult = {
  source:
    'openstreetmap-overpass'

  endpoint: string
  fetchedAt: string

  bounds:
    OsmFerryBounds

  routes:
    OsmImportedFerryRoute[]

  terminals:
    OsmImportedFerryTerminal[]
}

type OsmGeometryPoint = {
  lat: number
  lon: number
}

type OsmRelationMember = {
  type:
    | 'node'
    | 'way'
    | 'relation'

  ref: number
  role?: string

  lat?: number
  lon?: number

  geometry?:
    OsmGeometryPoint[]
}

type OsmElement = {
  type:
    | 'node'
    | 'way'
    | 'relation'

  id: number

  lat?: number
  lon?: number

  center?: {
    lat: number
    lon: number
  }

  geometry?:
    OsmGeometryPoint[]

  members?:
    OsmRelationMember[]

  tags?:
    Record<string, string>
}

type OverpassResponse = {
  elements?:
    OsmElement[]
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

function validCoordinate(
  value: number | undefined,
) {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(value)
  )
}

function toPoint(
  lat: number | undefined,
  lon: number | undefined,
): FerryGeoPoint | null {
  if (
    !validCoordinate(lat) ||
    !validCoordinate(lon)
  ) {
    return null
  }

  return {
    lat: lat as number,
    lng: lon as number,
  }
}

function averageGeometry(
  geometry:
    OsmGeometryPoint[] | undefined,
): FerryGeoPoint | null {
  if (
    !geometry ||
    geometry.length ===
      0
  ) {
    return null
  }

  const valid =
    geometry.filter(
      (point) =>
        validCoordinate(
          point.lat,
        ) &&
        validCoordinate(
          point.lon,
        ),
    )

  if (
    valid.length ===
      0
  ) {
    return null
  }

  const totals =
    valid.reduce(
      (
        current,
        point,
      ) => ({
        lat:
          current.lat +
          point.lat,

        lng:
          current.lng +
          point.lon,
      }),
      {
        lat: 0,
        lng: 0,
      },
    )

  return {
    lat:
      totals.lat /
      valid.length,

    lng:
      totals.lng /
      valid.length,
  }
}

function elementPoint(
  element:
    OsmElement,
): FerryGeoPoint | null {
  return (
    toPoint(
      element.lat,
      element.lon,
    ) ??
    toPoint(
      element.center?.lat,
      element.center?.lon,
    ) ??
    averageGeometry(
      element.geometry,
    )
  )
}

function normalizeAccessValue(
  value:
    string | undefined,
) {
  return value
    ?.trim()
    .toLowerCase()
}

function yesNoValue(
  value:
    string | undefined,
): boolean | undefined {
  const normalized =
    normalizeAccessValue(
      value,
    )

  if (
    normalized === 'yes' ||
    normalized === 'designated' ||
    normalized === 'permissive'
  ) {
    return true
  }

  if (
    normalized === 'no' ||
    normalized === 'private'
  ) {
    return false
  }

  return undefined
}

export function inferOsmMotorcycleAllowed(
  tags:
    Record<string, string>,
) {
  return (
    yesNoValue(
      tags.motorcycle,
    ) ??
    yesNoValue(
      tags.motor_vehicle,
    ) ??
    yesNoValue(
      tags.motorcar,
    )
  )
}

export function parseOsmDurationMinutes(
  value:
    string | undefined,
): number | undefined {
  if (!value) {
    return undefined
  }

  const clean =
    value.trim()

  if (!clean) {
    return undefined
  }

  if (
    /^\d+(?:\.\d+)?$/.test(
      clean,
    )
  ) {
    const minutes =
      Number(clean)

    return Number.isFinite(
      minutes,
    )
      ? minutes
      : undefined
  }

  const parts =
    clean
      .split(':')
      .map(Number)

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some(
      (part) =>
        !Number.isFinite(
          part,
        ),
    )
  ) {
    return undefined
  }

  const hours =
    parts[0] ?? 0

  const minutes =
    parts[1] ?? 0

  const seconds =
    parts[2] ?? 0

  return (
    hours * 60 +
    minutes +
    seconds / 60
  )
}

function elementKey(
  type: string,
  id: number,
) {
  return `${type}:${id}`
}

function relationMemberPoint(
  member:
    OsmRelationMember,
  elementMap:
    Map<string, OsmElement>,
) {
  return (
    toPoint(
      member.lat,
      member.lon,
    ) ??
    averageGeometry(
      member.geometry,
    ) ??
    (() => {
      const element =
        elementMap.get(
          elementKey(
            member.type,
            member.ref,
          ),
        )

      return element
        ? elementPoint(
            element,
          )
        : null
    })()
  )
}

function routeEndpointsFromWay(
  element:
    OsmElement,
) {
  const geometry =
    element.geometry

  if (
    !geometry ||
    geometry.length < 2
  ) {
    return null
  }

  const first =
    geometry[0]

  const last =
    geometry[
      geometry.length - 1
    ]

  const startPoint =
    toPoint(
      first?.lat,
      first?.lon,
    )

  const endPoint =
    toPoint(
      last?.lat,
      last?.lon,
    )

  if (
    !startPoint ||
    !endPoint
  ) {
    return null
  }

  return {
    startPoint,
    endPoint,
  }
}

function routeEndpointsFromRelation(
  element:
    OsmElement,
  elementMap:
    Map<string, OsmElement>,
) {
  const members =
    element.members ?? []

  const stopPoints =
    members
      .filter(
        (member) => {
          const role =
            member.role
              ?.trim()
              .toLowerCase()

          return (
            role === 'stop' ||
            role === 'platform'
          )
        },
      )
      .map(
        (member) =>
          relationMemberPoint(
            member,
            elementMap,
          ),
      )
      .filter(
        (
          point,
        ): point is FerryGeoPoint =>
          point !== null,
      )

  if (
    stopPoints.length >= 2
  ) {
    return {
      startPoint:
        stopPoints[0] as FerryGeoPoint,

      endPoint:
        stopPoints[
          stopPoints.length - 1
        ] as FerryGeoPoint,
    }
  }

  const routeMemberPoints =
    members
      .filter(
        (member) =>
          member.type ===
          'way',
      )
      .flatMap(
        (member) => {
          const geometry =
            member.geometry

          if (
            !geometry ||
            geometry.length ===
              0
          ) {
            return []
          }

          const first =
            geometry[0]

          const last =
            geometry[
              geometry.length - 1
            ]

          const firstPoint =
            toPoint(
              first?.lat,
              first?.lon,
            )

          const lastPoint =
            toPoint(
              last?.lat,
              last?.lon,
            )

          return [
            firstPoint,
            lastPoint,
          ].filter(
            (
              point,
            ): point is FerryGeoPoint =>
              point !== null,
          )
        },
      )

  if (
    routeMemberPoints.length >=
    2
  ) {
    return {
      startPoint:
        routeMemberPoints[0] as FerryGeoPoint,

      endPoint:
        routeMemberPoints[
          routeMemberPoints.length - 1
        ] as FerryGeoPoint,
    }
  }

  return null
}

function toImportedRoute(
  element:
    OsmElement,
  elementMap:
    Map<string, OsmElement>,
): OsmImportedFerryRoute | null {
  const tags =
    element.tags ?? {}

  if (
    tags.route !==
    'ferry'
  ) {
    return null
  }

  if (
    element.type !== 'way' &&
    element.type !== 'relation'
  ) {
    return null
  }

  const endpoints =
    element.type === 'way'
      ? routeEndpointsFromWay(
          element,
        )
      : routeEndpointsFromRelation(
          element,
          elementMap,
        )

  if (!endpoints) {
    return null
  }

  return {
    osmType:
      element.type,

    osmId:
      element.id,

    name:
      tags.name,

    ref:
      tags.ref,

    operator:
      tags.operator,

    fromName:
      tags.from,

    toName:
      tags.to,

    startPoint:
      endpoints.startPoint,

    endPoint:
      endpoints.endPoint,

    motorcycleAllowed:
      inferOsmMotorcycleAllowed(
        tags,
      ),

    durationMinutes:
      parseOsmDurationMinutes(
        tags.duration,
      ),

    tags,
  }
}

function toImportedTerminal(
  element:
    OsmElement,
): OsmImportedFerryTerminal | null {
  const tags =
    element.tags ?? {}

  if (
    tags.amenity !==
    'ferry_terminal'
  ) {
    return null
  }

  const point =
    elementPoint(
      element,
    )

  if (!point) {
    return null
  }

  return {
    osmType:
      element.type,

    osmId:
      element.id,

    name:
      tags.name ??
      tags['name:en'] ??
      tags['name:it'] ??
      `Ferry terminal ${element.id}`,

    operator:
      tags.operator,

    point,
  }
}

export function parseOsmFerryElements(
  elements:
    OsmElement[],
) {
  const elementMap =
    new Map<
      string,
      OsmElement
    >(
      elements.map(
        (element) => [
          elementKey(
            element.type,
            element.id,
          ),
          element,
        ],
      ),
    )

  const routes =
    elements
      .map(
        (element) =>
          toImportedRoute(
            element,
            elementMap,
          ),
      )
      .filter(
        (
          route,
        ): route is OsmImportedFerryRoute =>
          route !== null,
      )

  const terminals =
    elements
      .map(
        toImportedTerminal,
      )
      .filter(
        (
          terminal,
        ): terminal is OsmImportedFerryTerminal =>
          terminal !== null,
      )

  return {
    routes,
    terminals,
  }
}

function validateBounds(
  bounds:
    OsmFerryBounds,
) {
  const valid =
    [
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    ].every(
      Number.isFinite,
    ) &&
    bounds.south <
      bounds.north &&
    bounds.west <
      bounds.east

  if (!valid) {
    throw new Error(
      'Bounding box OSM non valida.',
    )
  }
}

export function buildOsmFerryOverpassQuery(
  bounds:
    OsmFerryBounds,
) {
  validateBounds(
    bounds,
  )

  const bbox =
    [
      bounds.south,
      bounds.west,
      bounds.north,
      bounds.east,
    ].join(',')

  return `
[out:json][timeout:60];
(
  way["route"="ferry"](${bbox});
  relation["route"="ferry"](${bbox});
  nwr["amenity"="ferry_terminal"](${bbox});
);
out body geom;
>;
out skel qt;
  `.trim()
}

async function fetchOverpass(
  endpoint: string,
  query: string,
  signal?:
    AbortSignal,
) {
  const response =
    await fetch(
      endpoint,
      {
        method:
          'POST',

        headers: {
          Accept:
            'application/json',

          'Content-Type':
            'application/x-www-form-urlencoded;charset=UTF-8',
        },

        body:
          `data=${encodeURIComponent(query)}`,

        signal,
      },
    )

  if (!response.ok) {
    throw new Error(
      `Overpass non disponibile (${response.status}).`,
    )
  }

  return (
    await response.json()
  ) as OverpassResponse
}

export async function fetchOsmFerriesForBounds(
  bounds:
    OsmFerryBounds,
  signal?:
    AbortSignal,
): Promise<OsmFerryImportResult> {
  const query =
    buildOsmFerryOverpassQuery(
      bounds,
    )

  let lastError:
    unknown = null

  for (
    const endpoint
    of OVERPASS_ENDPOINTS
  ) {
    try {
      const data =
        await fetchOverpass(
          endpoint,
          query,
          signal,
        )

      const parsed =
        parseOsmFerryElements(
          data.elements ??
          [],
        )

      return {
        source:
          'openstreetmap-overpass',

        endpoint,

        fetchedAt:
          new Date()
            .toISOString(),

        bounds,

        routes:
          parsed.routes,

        terminals:
          parsed.terminals,
      }
    } catch (error) {
      if (
        signal?.aborted
      ) {
        throw error
      }

      lastError =
        error
    }
  }

  throw (
    lastError instanceof Error
      ? lastError
      : new Error(
          'Importazione OSM non disponibile.',
        )
  )
}
