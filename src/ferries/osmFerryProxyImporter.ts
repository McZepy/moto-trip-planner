import {
  buildOsmFerryOverpassQuery,
  parseOsmFerryElements,
  type OsmFerryBounds,
  type OsmFerryImportResult,
} from './osmFerryImporter'

type ParsedElements =
  Parameters<
    typeof parseOsmFerryElements
  >[0]

type OverpassResponse = {
  elements?: ParsedElements
}

const DEV_OVERPASS_ENDPOINT =
  '/overpass/api/interpreter'

export async function fetchOsmFerriesForBoundsViaProxy(
  bounds: OsmFerryBounds,
  signal?: AbortSignal,
): Promise<OsmFerryImportResult> {
  const query =
    buildOsmFerryOverpassQuery(
      bounds,
    )

  const response =
    await fetch(
      DEV_OVERPASS_ENDPOINT,
      {
        method: 'POST',

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
      `Overpass via proxy non disponibile (${response.status}).`,
    )
  }

  const data =
    (await response.json()) as OverpassResponse

  const parsed =
    parseOsmFerryElements(
      data.elements ?? [],
    )

  return {
    source:
      'openstreetmap-overpass',

    endpoint:
      'overpass.private.coffee via Vite proxy',

    fetchedAt:
      new Date().toISOString(),

    bounds,

    routes:
      parsed.routes,

    terminals:
      parsed.terminals,
  }
}
