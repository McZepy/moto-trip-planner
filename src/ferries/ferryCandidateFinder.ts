import type {
  RoutePoint,
} from '../providers/routingProvider'

import {
  listRoutableFerryServices,
  type FerryServiceView,
} from './ferryCatalog'

import type {
  FerryGeoPoint,
} from './ferryCatalogTypes'

export type FerryCandidateDirection =
  | 'A_TO_B'
  | 'B_TO_A'

export type FerryCandidate = {
  serviceView:
    FerryServiceView

  direction:
    FerryCandidateDirection

  departurePoint:
    FerryGeoPoint

  arrivalPoint:
    FerryGeoPoint

  departurePortName:
    string

  arrivalPortName:
    string

  distanceToDepartureKm:
    number

  distanceFromArrivalKm:
    number

  directDistanceKm:
    number

  progressKm:
    number

  corridorRatio:
    number

  score:
    number
}

export type FerryCandidateFinderOptions = {
  maxCandidates?: number

  /*
   * Quanto può essere più lungo
   * il percorso geografico di accesso
   * rispetto alla distanza diretta.
   *
   * Non è un limite chilometrico fisso.
   */
  maxCorridorRatio?: number

  /*
   * Progresso minimo verso la
   * destinazione richiesto al traghetto.
   */
  minProgressKm?: number
}

const DEFAULT_MAX_CANDIDATES =
  12

const DEFAULT_MAX_CORRIDOR_RATIO =
  1.55

const DEFAULT_MIN_PROGRESS_KM =
  15

function toRadians(
  value: number,
) {
  return (
    value *
    Math.PI /
    180
  )
}

export function geoDistanceKm(
  first: FerryGeoPoint,
  second: FerryGeoPoint,
) {
  const earthRadiusKm =
    6371

  const deltaLat =
    toRadians(
      second.lat -
        first.lat,
    )

  const deltaLng =
    toRadians(
      second.lng -
        first.lng,
    )

  const firstLat =
    toRadians(
      first.lat,
    )

  const secondLat =
    toRadians(
      second.lat,
    )

  const a =
    Math.sin(
      deltaLat / 2,
    ) ** 2 +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(
        deltaLng / 2,
      ) ** 2

  return (
    earthRadiusKm *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a,
      ),
    )
  )
}

function terminalPoint(
  terminal:
    FerryServiceView['terminalA'],
) {
  if (!terminal) {
    return null
  }

  return (
    terminal
      .vehicleAccessPoint ??
    terminal
      .terminalPoint ??
    null
  )
}

function buildCandidate(
  start: RoutePoint,
  destination: RoutePoint,
  serviceView:
    FerryServiceView,
  direction:
    FerryCandidateDirection,
): FerryCandidate | null {
  const forward =
    direction ===
    'A_TO_B'

  const departureTerminal =
    forward
      ? serviceView
          .terminalA
      : serviceView
          .terminalB

  const arrivalTerminal =
    forward
      ? serviceView
          .terminalB
      : serviceView
          .terminalA

  const departurePoint =
    terminalPoint(
      departureTerminal,
    )

  const arrivalPoint =
    terminalPoint(
      arrivalTerminal,
    )

  if (
    !departurePoint ||
    !arrivalPoint
  ) {
    return null
  }

  const departurePort =
    forward
      ? serviceView.portA
      : serviceView.portB

  const arrivalPort =
    forward
      ? serviceView.portB
      : serviceView.portA

  const directDistanceKm =
    geoDistanceKm(
      start,
      destination,
    )

  const distanceToDepartureKm =
    geoDistanceKm(
      start,
      departurePoint,
    )

  const distanceFromArrivalKm =
    geoDistanceKm(
      arrivalPoint,
      destination,
    )

  const departureToDestinationKm =
    geoDistanceKm(
      departurePoint,
      destination,
    )

  const progressKm =
    departureToDestinationKm -
    distanceFromArrivalKm

  /*
   * Proxy economico.
   *
   * Serve solo a stabilire
   * se il traghetto è plausibile.
   *
   * Il confronto definitivo verrà
   * fatto successivamente con OSRM.
   */
  const landProxyKm =
    distanceToDepartureKm +
    distanceFromArrivalKm

  const corridorRatio =
    directDistanceKm > 1
      ? landProxyKm /
        directDistanceKm
      : landProxyKm

  /*
   * Diamo un piccolo peso anche
   * alla traversata marittima per
   * ordinare meglio i candidati,
   * senza fingere che equivalga
   * a strada.
   */
  const seaDistanceKm =
    serviceView.route
      .distanceKm ??
    geoDistanceKm(
      departurePoint,
      arrivalPoint,
    )

  const score =
    landProxyKm +
    seaDistanceKm * 0.15

  return {
    serviceView,

    direction,

    departurePoint,
    arrivalPoint,

    departurePortName:
      departurePort.name,

    arrivalPortName:
      arrivalPort.name,

    distanceToDepartureKm,

    distanceFromArrivalKm,

    directDistanceKm,

    progressKm,

    corridorRatio,

    score,
  }
}

export function findFerryCandidates(
  start: RoutePoint,
  destination: RoutePoint,
  options:
    FerryCandidateFinderOptions =
      {},
) {
  const maxCandidates =
    options.maxCandidates ??
    DEFAULT_MAX_CANDIDATES

  const maxCorridorRatio =
    options.maxCorridorRatio ??
    DEFAULT_MAX_CORRIDOR_RATIO

  const minProgressKm =
    options.minProgressKm ??
    DEFAULT_MIN_PROGRESS_KM

  return (
    listRoutableFerryServices()
      .flatMap(
        (serviceView) => [
          buildCandidate(
            start,
            destination,
            serviceView,
            'A_TO_B',
          ),

          ...(serviceView
            .route
            .bidirectional
            ? [
                buildCandidate(
                  start,
                  destination,
                  serviceView,
                  'B_TO_A',
                ),
              ]
            : []),
        ],
      )
      .filter(
        (
          candidate,
        ): candidate is FerryCandidate =>
          candidate !==
          null,
      )
      .filter(
        (candidate) =>
          candidate
            .progressKm >=
            minProgressKm,
      )
      .filter(
        (candidate) =>
          candidate
            .corridorRatio <=
            maxCorridorRatio,
      )
      .sort(
        (
          first,
          second,
        ) =>
          first.score -
          second.score,
      )
      .slice(
        0,
        maxCandidates,
      )
  )
}
