import {
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

const REQUEST_TIMEOUT_MS =
  25000

function buildLightweightQuery(
  bounds: OsmFerryBounds,
) {
  const bbox = [
    bounds.south,
    bounds.west,
    bounds.north,
    bounds.east,
  ].join(',')

  return `
[out:json][timeout:20];
(
  way["route"="ferry"](${bbox});
  relation["route"="ferry"](${bbox});
  nwr["amenity"="ferry_terminal"](${bbox});
);
out body geom;
  `.trim()
}

export async function fetchOsmFerriesForBoundsViaProxy(
  bounds: OsmFerryBounds,
  signal?: AbortSignal,
): Promise<OsmFerryImportResult> {
  const query =
    buildLightweightQuery(
      bounds,
    )

  const controller =
    new AbortController()

  const timeoutId =
    window.setTimeout(
      () =>
        controller.abort(),
      REQUEST_TIMEOUT_MS,
    )

  const handleExternalAbort =
    () => controller.abort()

  signal?.addEventListener(
    'abort',
    handleExternalAbort,
    { once: true },
  )

  try {
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

          signal:
            controller.signal,
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
        'overpass-api.de via Vite proxy',

      fetchedAt:
        new Date().toISOString(),

      bounds,

      routes:
        parsed.routes,

      terminals:
        parsed.terminals,
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new Error(
        'Overpass non ha risposto entro 25 secondi.',
      )
    }

    throw error
  } finally {
    window.clearTimeout(
      timeoutId,
    )

    signal?.removeEventListener(
      'abort',
      handleExternalAbort,
    )
  }
}
