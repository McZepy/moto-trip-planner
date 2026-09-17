import {
  getFerryCatalog,
  resetFerryCatalog,
  setFerryCatalog,
} from './ferryCatalog'

import {
  mergeFerryCatalogs,
  type FerryCatalogMergeResult,
} from './ferryCatalogMerger'

import {
  FERRY_CATALOG_SEED,
} from './ferryCatalogSeed'

import {
  normalizeOsmFerryImport,
  type OsmFerryNormalizationResult,
} from './osmFerryCatalogNormalizer'

import {
  parseOsmFerryElements,
  type OsmFerryBounds,
  type OsmFerryImportResult,
} from './osmFerryImporter'

type ParsedElements =
  Parameters<
    typeof parseOsmFerryElements
  >[0]

type RawOsmFerryDataset = {
  schemaVersion?: number
  source?: string
  generatedAt?: string
  bounds?: unknown
  regions?: unknown
  elementCount?: number
  elements?: unknown
}

export type FerryCatalogRuntimeBuildResult = {
  generatedAt: string
  rawElementCount: number
  importedRouteCount: number
  importedTerminalCount: number
  normalization:
    OsmFerryNormalizationResult
  merge:
    FerryCatalogMergeResult
}

export type FerryCatalogRuntimeLoadResult =
  | {
      status: 'loaded'
      url: string
      build:
        FerryCatalogRuntimeBuildResult
    }
  | {
      status: 'fallback'
      url: string
      reason: string
    }

export type FerryCatalogRuntimeLoadOptions = {
  url?: string
  fetcher?: typeof fetch
}

const DEFAULT_DATASET_URL =
  '/data/osm-ferries-europe.json'

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  )
}

function numericField(
  value: unknown,
  field: string,
) {
  if (!isRecord(value)) {
    return null
  }

  const fieldValue =
    value[field]

  return (
    typeof fieldValue === 'number' &&
    Number.isFinite(fieldValue)
  )
    ? fieldValue
    : null
}

function toBounds(
  value: unknown,
): OsmFerryBounds | null {
  const south =
    numericField(value, 'south')
  const west =
    numericField(value, 'west')
  const north =
    numericField(value, 'north')
  const east =
    numericField(value, 'east')

  if (
    south === null ||
    west === null ||
    north === null ||
    east === null ||
    south >= north ||
    west >= east
  ) {
    return null
  }

  return {
    south,
    west,
    north,
    east,
  }
}

function resolveDatasetBounds(
  dataset: RawOsmFerryDataset,
) {
  const direct =
    toBounds(dataset.bounds)

  if (direct) {
    return direct
  }

  const regions =
    Array.isArray(dataset.regions)
      ? dataset.regions
          .map(toBounds)
          .filter(
            (
              bounds,
            ): bounds is OsmFerryBounds =>
              bounds !== null,
          )
      : []

  if (regions.length === 0) {
    throw new Error(
      'Dataset OSM privo di limiti geografici validi.',
    )
  }

  return {
    south:
      Math.min(
        ...regions.map(
          (region) =>
            region.south,
        ),
      ),
    west:
      Math.min(
        ...regions.map(
          (region) =>
            region.west,
        ),
      ),
    north:
      Math.max(
        ...regions.map(
          (region) =>
            region.north,
        ),
      ),
    east:
      Math.max(
        ...regions.map(
          (region) =>
            region.east,
        ),
      ),
  }
}

function parseDataset(
  raw: unknown,
) {
  if (!isRecord(raw)) {
    throw new Error(
      'Dataset OSM non valido.',
    )
  }

  const dataset =
    raw as RawOsmFerryDataset

  if (
    typeof dataset.generatedAt !==
      'string' ||
    !dataset.generatedAt.trim()
  ) {
    throw new Error(
      'Dataset OSM senza data di generazione.',
    )
  }

  if (
    !Array.isArray(
      dataset.elements,
    ) ||
    dataset.elements.length === 0
  ) {
    throw new Error(
      'Dataset OSM senza elementi utilizzabili.',
    )
  }

  return {
    dataset,
    bounds:
      resolveDatasetBounds(
        dataset,
      ),
    elements:
      dataset.elements as ParsedElements,
  }
}

export function buildRuntimeFerryCatalogFromOsmDataset(
  raw: unknown,
): FerryCatalogRuntimeBuildResult {
  const parsedDataset =
    parseDataset(raw)

  const imported =
    parseOsmFerryElements(
      parsedDataset.elements,
    )

  if (imported.routes.length === 0) {
    throw new Error(
      'Dataset OSM senza rotte ferry interpretabili.',
    )
  }

  const importResult:
    OsmFerryImportResult = {
    source:
      'openstreetmap-overpass',
    endpoint:
      'static-dataset',
    fetchedAt:
      parsedDataset.dataset
        .generatedAt as string,
    bounds:
      parsedDataset.bounds,
    routes:
      imported.routes,
    terminals:
      imported.terminals,
  }

  const normalization =
    normalizeOsmFerryImport(
      importResult,
    )

  if (
    normalization.catalog
      .routes.length === 0 ||
    normalization.catalog
      .services.length === 0
  ) {
    throw new Error(
      'Normalizzazione OSM priva di rotte utilizzabili.',
    )
  }

  const merge =
    mergeFerryCatalogs(
      FERRY_CATALOG_SEED,
      normalization.catalog,
    )

  return {
    generatedAt:
      importResult.fetchedAt,
    rawElementCount:
      parsedDataset.elements.length,
    importedRouteCount:
      imported.routes.length,
    importedTerminalCount:
      imported.terminals.length,
    normalization,
    merge,
  }
}

export function activateRuntimeFerryCatalogFromOsmDataset(
  raw: unknown,
) {
  const build =
    buildRuntimeFerryCatalogFromOsmDataset(
      raw,
    )

  setFerryCatalog(
    build.merge.catalog,
  )

  return build
}

export async function loadAndActivateRuntimeFerryCatalog(
  options:
    FerryCatalogRuntimeLoadOptions = {},
): Promise<FerryCatalogRuntimeLoadResult> {
  const url =
    options.url ??
    DEFAULT_DATASET_URL

  const fetcher =
    options.fetcher ??
    fetch

  try {
    const response =
      await fetcher(
        url,
        {
          headers: {
            Accept:
              'application/json',
          },
        },
      )

    if (!response.ok) {
      throw new Error(
        `Dataset OSM non disponibile (${response.status}).`,
      )
    }

    const raw =
      await response.json() as unknown

    const build =
      activateRuntimeFerryCatalogFromOsmDataset(
        raw,
      )

    return {
      status: 'loaded',
      url,
      build,
    }
  } catch (error) {
    resetFerryCatalog()

    return {
      status: 'fallback',
      url,
      reason:
        error instanceof Error
          ? error.message
          : 'Errore sconosciuto durante il caricamento OSM.',
    }
  }
}

export function runtimeFerryCatalogIsSeed() {
  return (
    getFerryCatalog() ===
    FERRY_CATALOG_SEED
  )
}
