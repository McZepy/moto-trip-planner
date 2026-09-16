import type {
    GeoBoundingBox,
    GeocodingResult,
  } from './geocodingProvider'
  
  import {
    osrmRoutingProvider,
    type RoutePoint,
  } from './routingProvider'
  
  const OSRM_BASE_URL =
    'https://router.project-osrm.org'
  
  const AREA_TYPES = new Set([
    'city',
    'town',
    'village',
    'hamlet',
    'municipality',
    'county',
    'state',
    'region',
    'province',
    'administrative',
  ])
  
  type NearestCandidate = RoutePoint & {
    distance: number
  }
  
  export function isAreaResult(
    result: GeocodingResult,
  ) {
    if (
      result.category ===
      'boundary'
    ) {
      return true
    }
  
    if (!result.type) {
      return false
    }
  
    return AREA_TYPES.has(
      result.type,
    )
  }
  
  function isPointInsideBox(
    point: RoutePoint,
    box: GeoBoundingBox,
  ) {
    return (
      point.lat >= box.south &&
      point.lat <= box.north &&
      point.lng >= box.west &&
      point.lng <= box.east
    )
  }
  
  async function getNearestCandidates(
    point: RoutePoint,
    number = 1,
  ): Promise<NearestCandidate[]> {
    const url =
      `${OSRM_BASE_URL}/nearest/v1/driving/` +
      `${point.lng},${point.lat}` +
      `?number=${number}`
  
    const response =
      await fetch(url)
  
    if (!response.ok) {
      throw new Error(
        'Impossibile individuare una strada percorribile.',
      )
    }
  
    const data =
      await response.json()
  
    if (
      !Array.isArray(
        data.waypoints,
      )
    ) {
      return []
    }
  
    return data.waypoints
      .filter(
        (item: {
          location?: unknown
        }) =>
          Array.isArray(
            item.location,
          ),
      )
      .map(
        (item: {
          location: [
            number,
            number,
          ]
          distance?: number
        }) => ({
          lng:
            Number(
              item.location[0],
            ),
  
          lat:
            Number(
              item.location[1],
            ),
  
          distance:
            Number(
              item.distance ?? 0,
            ),
        }),
      )
  }
  
  export async function snapToRoad(
    point: RoutePoint,
  ): Promise<RoutePoint> {
    const candidates =
      await getNearestCandidates(
        point,
        1,
      )
  
    if (
      candidates.length === 0
    ) {
      throw new Error(
        'Nessuna strada percorribile trovata vicino al punto.',
      )
    }
  
    return {
      lat:
        candidates[0].lat,
  
      lng:
        candidates[0].lng,
    }
  }
  
  function createZoneTargets(
    box: GeoBoundingBox,
  ): RoutePoint[] {
    const width =
      box.east - box.west
  
    const height =
      box.north - box.south
  
    /*
     * Usiamo punti INTERNI alla zona.
     * Non usiamo i bordi del bounding box.
     */
  
    const positions = [
      [0.5, 0.5],
  
      [0.3, 0.3],
      [0.7, 0.3],
  
      [0.3, 0.7],
      [0.7, 0.7],
    ]
  
    return positions.map(
      ([x, y]) => ({
        lng:
          box.west +
          width * x,
  
        lat:
          box.south +
          height * y,
      }),
    )
  }
  
  function removeDuplicatePoints(
    points: RoutePoint[],
  ) {
    const seen =
      new Set<string>()
  
    return points.filter(
      (point) => {
        const key =
          `${point.lat.toFixed(5)}:` +
          `${point.lng.toFixed(5)}`
  
        if (seen.has(key)) {
          return false
        }
  
        seen.add(key)
  
        return true
      },
    )
  }
  
  async function chooseBestRouteCandidate(
    previous: RoutePoint,
    next: RoutePoint,
    candidates: RoutePoint[],
  ): Promise<RoutePoint> {
    if (
      candidates.length === 0
    ) {
      throw new Error(
        'Nessuna strada adatta trovata.',
      )
    }
  
    if (
      candidates.length === 1
    ) {
      return candidates[0]
    }
  
    const points = [
      previous,
      ...candidates,
      next,
    ]
  
    const coordinates =
      points
        .map(
          (point) =>
            `${point.lng},${point.lat}`,
        )
        .join(';')
  
    const url =
      `${OSRM_BASE_URL}/table/v1/driving/` +
      `${coordinates}` +
      '?annotations=distance'
  
    const response =
      await fetch(url)
  
    if (!response.ok) {
      return candidates[0]
    }
  
    const data =
      await response.json()
  
    const distances:
      Array<
        Array<number | null>
      > =
        data.distances
  
    if (
      !Array.isArray(distances)
    ) {
      return candidates[0]
    }
  
    const destinationIndex =
      points.length - 1
  
    let bestCandidate =
      candidates[0]
  
    let bestDistance =
      Number.POSITIVE_INFINITY
  
    candidates.forEach(
      (
        candidate,
        index,
      ) => {
        const candidateIndex =
          index + 1
  
        const firstLeg =
          distances[0]?.[
            candidateIndex
          ]
  
        const secondLeg =
          distances[
            candidateIndex
          ]?.[
            destinationIndex
          ]
  
        if (
          typeof firstLeg !==
            'number' ||
          typeof secondLeg !==
            'number'
        ) {
          return
        }
  
        const total =
          firstLeg +
          secondLeg
  
        if (
          total <
          bestDistance
        ) {
          bestDistance =
            total
  
          bestCandidate =
            candidate
        }
      },
    )
  
    return bestCandidate
  }
  
  async function routeAlreadyCrossesZone(
    previous: RoutePoint,
    next: RoutePoint,
    box: GeoBoundingBox,
  ) {
    const route =
      await osrmRoutingProvider
        .calculateRoute([
          previous,
          next,
        ])
  
    return route.geometry.coordinates
      .some(
        (coordinate) =>
          isPointInsideBox(
            {
              lng:
                coordinate[0],
  
              lat:
                coordinate[1],
            },
  
            box,
          ),
      )
  }
  
  /*
   * PASSAGGIO ZONA
   *
   * null significa:
   * il percorso migliore attraversa già la zona,
   * quindi NON dobbiamo aggiungere alcun waypoint.
   */
  
  export async function resolveZonePassPoint(
    result: {
      lat: number
      lng: number
      boundingBox?: GeoBoundingBox
    },
  
    previous: RoutePoint,
  
    next: RoutePoint,
  ): Promise<RoutePoint | null> {
    const box =
      result.boundingBox
  
    if (!box) {
      throw new Error(
        'Questa località non dispone di un’area geografica utilizzabile come Passaggio zona.',
      )
    }
  
    const alreadyCrosses =
      await routeAlreadyCrossesZone(
        previous,
        next,
        box,
      )
  
    if (alreadyCrosses) {
      return null
    }
  
    const targets =
      createZoneTargets(
        box,
      )
  
    const snappedGroups =
      await Promise.all(
        targets.map(
          async (target) => {
            try {
              return await getNearestCandidates(
                target,
                1,
              )
            } catch {
              return []
            }
          },
        ),
      )
  
    const snapped =
      removeDuplicatePoints(
        snappedGroups
          .flat()
          .filter(
            (candidate) =>
              isPointInsideBox(
                candidate,
                box,
              ),
          ),
      )
  
    if (
      snapped.length === 0
    ) {
      throw new Error(
        'Non ho trovato una strada percorribile affidabile all’interno della zona selezionata.',
      )
    }
  
    return chooseBestRouteCandidate(
      previous,
      next,
      snapped,
    )
  }
  
  /*
   * PUNTO STRADA
   *
   * Non prendiamo automaticamente la strada
   * geometricamente più vicina.
   *
   * Valutiamo più strade vicine e scegliamo
   * quella che produce il percorso migliore
   * fra tappa precedente e successiva.
   */
  
  export async function resolveRoadPoint(
    clickedPoint: RoutePoint,
  
    previous?: RoutePoint,
  
    next?: RoutePoint,
  ): Promise<RoutePoint> {
    const candidates =
      await getNearestCandidates(
        clickedPoint,
        5,
      )
  
    if (
      candidates.length === 0
    ) {
      throw new Error(
        'Nessuna strada percorribile trovata vicino al punto selezionato.',
      )
    }
  
    const nearestDistance =
      candidates[0].distance
  
    /*
     * Evitiamo che OSRM scelga una strada
     * molto distante solo perché produce
     * un percorso più corto.
     */
  
    const acceptableDistance =
      Math.max(
        60,
        nearestDistance + 35,
      )
  
    const nearbyCandidates =
      candidates.filter(
        (candidate) =>
          candidate.distance <=
          acceptableDistance,
      )
  
    if (
      !previous ||
      !next ||
      nearbyCandidates.length === 1
    ) {
      return {
        lat:
          nearbyCandidates[0].lat,
  
        lng:
          nearbyCandidates[0].lng,
      }
    }
  
    return chooseBestRouteCandidate(
      previous,
      next,
      nearbyCandidates,
    )
  }