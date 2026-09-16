export type RoutePoint = {
  lng: number
  lat: number
}

export type RouteGeometry = {
  type: 'LineString'
  coordinates: number[][]
}

export type RouteResult = {
  distanceMeters: number
  durationSeconds: number
  geometry: RouteGeometry
}

export interface RoutingProvider {
  calculateRoute(
    points: RoutePoint[],
  ): Promise<RouteResult>
}

const OSRM_BASE_URL =
  'https://router.project-osrm.org'

export const osrmRoutingProvider: RoutingProvider = {
  async calculateRoute(points) {
    if (points.length < 2) {
      throw new Error(
        'Servono almeno partenza e destinazione.',
      )
    }

    const coordinates =
      points
        .map(
          (point) =>
            `${point.lng},${point.lat}`,
        )
        .join(';')

    const url =
      `${OSRM_BASE_URL}/route/v1/driving/${coordinates}` +
      '?overview=full&geometries=geojson&steps=false'

    const response =
      await fetch(url)

    if (!response.ok) {
      throw new Error(
        'Il server di routing non risponde.',
      )
    }

    const data =
      await response.json()

    if (
      data.code !== 'Ok' ||
      !data.routes?.length
    ) {
      throw new Error(
        'Nessun percorso stradale trovato.',
      )
    }

    const route =
      data.routes[0]

    return {
      distanceMeters:
        route.distance,

      durationSeconds:
        route.duration,

      geometry:
        route.geometry,
    }
  },
}