import {
  LngLatBounds,
  type Map,
} from 'maplibre-gl'

import type { TripRoutePlan } from '../providers/tripRoutePlanner'
import { drawPlannedRoute } from './routeSectionRenderer'

export function showTripRoutePlan(
  map: Map,
  plan: TripRoutePlan,
) {
  drawPlannedRoute(
    map,
    plan,
  )

  const coordinates =
    plan.sections.flatMap(
      (section) =>
        section.geometry.coordinates,
    )

  if (coordinates.length === 0) {
    return
  }

  const first =
    coordinates[0] as [
      number,
      number,
    ]

  const bounds =
    coordinates.reduce(
      (
        current,
        coordinate,
      ) =>
        current.extend(
          coordinate as [
            number,
            number,
          ],
        ),
      new LngLatBounds(
        first,
        first,
      ),
    )

  map.fitBounds(
    bounds,
    {
      padding: 70,
    },
  )
}
