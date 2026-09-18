import type {
  Map,
} from 'maplibre-gl'

import type {
  RouteGeometry,
} from '../providers/routingProvider'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

type VisualRouteSection = {
  type:
    | 'road'
    | 'ferry'

  geometry:
    RouteGeometry
}

const SOURCE_PREFIX =
  'planned-route-section-source-'

const LAYER_PREFIX =
  'planned-route-section-layer-'

function sourceId(
  index: number,
) {
  return (
    SOURCE_PREFIX +
    index
  )
}

function layerId(
  index: number,
) {
  return (
    LAYER_PREFIX +
    index
  )
}

export function clearPlannedRoute(
  map: Map,
) {
  let index =
    0

  while (
    map.getLayer(
      layerId(
        index,
      ),
    ) ||
    map.getSource(
      sourceId(
        index,
      ),
    )
  ) {
    const currentLayerId =
      layerId(
        index,
      )

    const currentSourceId =
      sourceId(
        index,
      )

    if (
      map.getLayer(
        currentLayerId,
      )
    ) {
      map.removeLayer(
        currentLayerId,
      )
    }

    if (
      map.getSource(
        currentSourceId,
      )
    ) {
      map.removeSource(
        currentSourceId,
      )
    }

    index +=
      1
  }
}

function addSection(
  map: Map,
  section:
    VisualRouteSection,
  index: number,
) {
  const currentSourceId =
    sourceId(
      index,
    )

  const currentLayerId =
    layerId(
      index,
    )

  map.addSource(
    currentSourceId,
    {
      type: 'geojson',

      data: {
        type:
          'Feature',

        properties: {
          sectionType:
            section.type,
        },

        geometry:
          section.geometry,
      },
    },
  )

  map.addLayer({
    id:
      currentLayerId,

    type:
      'line',

    source:
      currentSourceId,

    layout: {
      'line-join':
        'round',

      'line-cap':
        'round',
    },

    paint:
      section.type ===
      'ferry'
        ? {
            'line-color':
              '#f97316',

            'line-width':
              5,

            'line-dasharray':
              [
                2,
                2,
              ],
          }
        : {
            'line-color':
              '#2563eb',

            'line-width':
              5,
          },
  })
}

export function drawPlannedRoute(
  map: Map,
  plan:
    TripRoutePlan,
) {
  clearPlannedRoute(
    map,
  )

  const visuals:
    VisualRouteSection[] = []

  plan.sections.forEach(
    (
      section,
    ) => {
      visuals.push({
        type:
          section.type,

        geometry:
          section.geometry,
      })

      if (
        section.type ===
          'road'
      ) {
        for (
          const ferry
          of section
            .embeddedFerries ??
          []
        ) {
          visuals.push({
            type:
              'ferry',

            geometry:
              ferry.geometry,
          })
        }
      }
    },
  )

  visuals.forEach(
    (
      section,
      index,
    ) => {
      addSection(
        map,
        section,
        index,
      )
    },
  )
}
