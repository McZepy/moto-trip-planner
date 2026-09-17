import fs from 'node:fs/promises'
import path from 'node:path'

const EUROPE_BOUNDS = {
  south: 34,
  west: -25,
  north: 72,
  east: 45,
}

const TILE_LAT = 10
const TILE_LON = 10
const REQUEST_GAP_MS = 900
const REQUEST_TIMEOUT_MS = 120_000

const ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeTiles(bounds) {
  const tiles = []

  for (let south = bounds.south; south < bounds.north; south += TILE_LAT) {
    const north = Math.min(south + TILE_LAT, bounds.north)

    for (let west = bounds.west; west < bounds.east; west += TILE_LON) {
      const east = Math.min(west + TILE_LON, bounds.east)
      tiles.push({ south, west, north, east })
    }
  }

  return tiles
}

function buildQuery(tile) {
  const bbox = [tile.south, tile.west, tile.north, tile.east].join(',')

  return `
[out:json][timeout:90];
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
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'MotoRoute ferry catalog builder',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchTile(tile) {
  const query = buildQuery(tile)
  let lastError = null

  for (const endpoint of ENDPOINTS) {
    try {
      const data = await fetchEndpoint(endpoint, query)

      return {
        endpoint,
        elements: Array.isArray(data.elements) ? data.elements : [],
      }
    } catch (error) {
      lastError = error
      console.warn(
        `Endpoint fallito ${endpoint}:`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  throw new Error(
    `Tutti gli endpoint Overpass hanno fallito per tile ${JSON.stringify(tile)}: ${
      lastError instanceof Error ? lastError.message : 'errore sconosciuto'
    }`,
  )
}

function elementKey(element) {
  return `${element.type}:${element.id}`
}

async function main() {
  const tiles = makeTiles(EUROPE_BOUNDS)
  console.log(`MotoRoute ferry catalog: ${tiles.length} tile Europa`)

  const merged = new Map()
  const endpointStats = new Map()

  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index]
    console.log(`[${index + 1}/${tiles.length}]`, tile)

    const result = await fetchTile(tile)

    endpointStats.set(
      result.endpoint,
      (endpointStats.get(result.endpoint) ?? 0) + 1,
    )

    for (const element of result.elements) {
      merged.set(elementKey(element), element)
    }

    await sleep(REQUEST_GAP_MS)
  }

  const elements = [...merged.values()]

  elements.sort(
    (a, b) =>
      String(a.type).localeCompare(String(b.type)) ||
      Number(a.id) - Number(b.id),
  )

  const output = {
    schemaVersion: 1,
    source: 'openstreetmap-overpass',
    generatedAt: new Date().toISOString(),
    bounds: EUROPE_BOUNDS,
    tileSize: {
      lat: TILE_LAT,
      lon: TILE_LON,
    },
    endpoints: Object.fromEntries(endpointStats),
    elementCount: elements.length,
    elements,
  }

  const outputPath = path.join(
    process.cwd(),
    'public',
    'data',
    'osm-ferries-europe.json',
  )

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8')

  console.log(`Catalogo scritto: ${outputPath}`)
  console.log(`Elementi OSM univoci: ${elements.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
