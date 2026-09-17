import fs from 'node:fs/promises'
import path from 'node:path'

const REQUEST_GAP_MS = 500
const REQUEST_TIMEOUT_MS = 30_000

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const REGIONS = [
  {
    id: 'iberia-atlantic',
    south: 35,
    west: -12,
    north: 45,
    east: 1,
  },
  {
    id: 'channel-biscay',
    south: 43,
    west: -7,
    north: 52,
    east: 4,
  },
  {
    id: 'uk-ireland',
    south: 49,
    west: -11,
    north: 59,
    east: 3,
  },
  {
    id: 'north-sea',
    south: 52,
    west: 0,
    north: 61,
    east: 11,
  },
  {
    id: 'skagerrak',
    south: 55,
    west: 6,
    north: 61,
    east: 14,
  },
  {
    id: 'norway-west',
    south: 58,
    west: 3,
    north: 72,
    east: 11,
  },
  {
    id: 'baltic-west',
    south: 53,
    west: 9,
    north: 62,
    east: 21,
  },
  {
    id: 'baltic-east',
    south: 54,
    west: 18,
    north: 67,
    east: 32,
  },
  {
    id: 'west-mediterranean',
    south: 36,
    west: -1,
    north: 45,
    east: 10,
  },
  {
    id: 'italy-islands',
    south: 36,
    west: 7,
    north: 46,
    east: 16,
  },
  {
    id: 'adriatic',
    south: 39,
    west: 12,
    north: 47,
    east: 21,
  },
  {
    id: 'aegean',
    south: 34,
    west: 18,
    north: 42,
    east: 30,
  },
  {
    id: 'east-mediterranean',
    south: 34,
    west: 27,
    north: 43,
    east: 42,
  },
  {
    id: 'iceland-faroe',
    south: 62,
    west: -25,
    north: 68,
    east: -5,
  },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildQuery(region) {
  const bbox = [
    region.south,
    region.west,
    region.north,
    region.east,
  ].join(',')

  return `
[out:json][timeout:25];
(
  way["route"="ferry"](${bbox});
  relation["route"="ferry"](${bbox});
  nwr["amenity"="ferry_terminal"](${bbox});
);
out body geom qt;
  `.trim()
}

async function fetchEndpoint(endpoint, query) {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type':
          'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent':
          'MotoRoute ferry catalog builder',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}`,
      )
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchRegion(region) {
  const query = buildQuery(region)
  const errors = []

  for (const endpoint of ENDPOINTS) {
    try {
      const data = await fetchEndpoint(
        endpoint,
        query,
      )

      return {
        ok: true,
        endpoint,
        elements:
          Array.isArray(data.elements)
            ? data.elements
            : [],
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error)

      errors.push({
        endpoint,
        message,
      })

      console.warn(
        `Endpoint fallito ${endpoint}: ${message}`,
      )
    }
  }

  return {
    ok: false,
    elements: [],
    errors,
  }
}

function elementKey(element) {
  return `${element.type}:${element.id}`
}

async function readPreviousCatalog(outputPath) {
  try {
    const raw = await fs.readFile(
      outputPath,
      'utf8',
    )

    const parsed = JSON.parse(raw)

    return Array.isArray(parsed.elements)
      ? parsed.elements
      : []
  } catch {
    return []
  }
}

async function main() {
  const outputPath = path.join(
    process.cwd(),
    'public',
    'data',
    'osm-ferries-europe.json',
  )

  const previousElements =
    await readPreviousCatalog(outputPath)

  const merged = new Map(
    previousElements.map((element) => [
      elementKey(element),
      element,
    ]),
  )

  const endpointStats = new Map()
  const successfulRegions = []
  const failedRegions = []

  console.log(
    `MotoRoute ferry catalog: ${REGIONS.length} regioni marittime europee`,
  )

  for (
    let index = 0;
    index < REGIONS.length;
    index += 1
  ) {
    const region = REGIONS[index]

    console.log(
      `[${index + 1}/${REGIONS.length}] ${region.id}`,
    )

    const result = await fetchRegion(region)

    if (!result.ok) {
      failedRegions.push({
        id: region.id,
        errors: result.errors,
      })

      console.warn(
        `Regione saltata: ${region.id}`,
      )

      continue
    }

    successfulRegions.push(region.id)

    endpointStats.set(
      result.endpoint,
      (endpointStats.get(result.endpoint) ?? 0) + 1,
    )

    for (const element of result.elements) {
      merged.set(
        elementKey(element),
        element,
      )
    }

    console.log(
      `  ${result.elements.length} elementi via ${result.endpoint}`,
    )

    await sleep(REQUEST_GAP_MS)
  }

  const elements = [...merged.values()]

  elements.sort(
    (a, b) =>
      String(a.type).localeCompare(
        String(b.type),
      ) ||
      Number(a.id) - Number(b.id),
  )

  if (
    successfulRegions.length === 0 &&
    elements.length === 0
  ) {
    throw new Error(
      'Nessuna regione Overpass disponibile e nessun catalogo precedente da conservare.',
    )
  }

  const output = {
    schemaVersion: 2,
    source: 'openstreetmap-overpass',
    generatedAt:
      new Date().toISOString(),
    updateMode:
      'incremental-best-effort',
    regions: REGIONS,
    successfulRegions,
    failedRegions,
    endpoints:
      Object.fromEntries(
        endpointStats,
      ),
    previousElementCount:
      previousElements.length,
    elementCount:
      elements.length,
    elements,
  }

  await fs.mkdir(
    path.dirname(outputPath),
    {
      recursive: true,
    },
  )

  await fs.writeFile(
    outputPath,
    `${JSON.stringify(output)}\n`,
    'utf8',
  )

  console.log(
    `Catalogo scritto: ${outputPath}`,
  )
  console.log(
    `Regioni riuscite: ${successfulRegions.length}/${REGIONS.length}`,
  )
  console.log(
    `Elementi OSM univoci: ${elements.length}`,
  )

  if (failedRegions.length > 0) {
    console.warn(
      `Regioni non aggiornate: ${failedRegions.map((item) => item.id).join(', ')}`,
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
