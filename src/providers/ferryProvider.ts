import type {
  RoutePoint,
} from './routingProvider'

export type FerryPort = {
  name: string
  country: string

  terminalName?: string
  address?: string

  point: RoutePoint
}

export type FerryConnection = {
  id: string
  operator: string
  departurePort: FerryPort
  arrivalPort: FerryPort
  durationMinutes: number
  distanceKm: number
  motorcycleAllowed: boolean
  yearRound: boolean
  notes?: string
}

export type FerryCandidate = {
  connection: FerryConnection
  reversed: boolean
  departurePort: FerryPort
  arrivalPort: FerryPort
  distanceToDepartureKm: number
  distanceFromArrivalKm: number
  scoreKm: number
}

export type FerryProposal =
  | {
      type: 'road'
      reason: string
    }
  | {
      type: 'ferry'
      candidate: FerryCandidate
    }

const MAX_APPROACH_KM = 350
const MAX_EXIT_KM = 350

/*
 * Catalogo iniziale V0.4C2.
 *
 * Per ora inseriamo soltanto collegamenti verificati
 * per il test controllato Hirtshals -> Norvegia.
 * Il catalogo verrà ampliato in una fase successiva.
 */
const FERRY_CONNECTIONS: FerryConnection[] = [
  {
    id: 'hirtshals-bergen',
    operator: 'Fjord Line',

    departurePort: {
      name: 'Hirtshals',
      country: 'Danimarca',

      terminalName:
        'Fjord Line Terminal Hirtshals',

      address:
        'Nordsøterminalen, Containerkajen 4, 9850 Hirtshals, Danimarca',

      point: {
        lat: 57.596364,
        lng: 9.973799,
      },
    },

    arrivalPort: {
      name: 'Bergen',
      country: 'Norvegia',

      terminalName:
        'Jekteviksterminalen',

      address:
        'Nøstegaten 30, 5006 Bergen, Norvegia',

      point: {
        lat: 60.392069,
        lng: 5.311952,
      },
    },

    durationMinutes: 1050,
    distanceKm: 600,
    motorcycleAllowed: true,
    yearRound: true,

    notes:
      'Collegamento diretto Hirtshals–Stavanger–Bergen.',
  },

  {
    id: 'hirtshals-kristiansand',
    operator: 'Fjord Line',

    departurePort: {
      name: 'Hirtshals',
      country: 'Danimarca',

      terminalName:
        'Fjord Line Terminal Hirtshals',

      address:
        'Nordsøterminalen, Containerkajen 4, 9850 Hirtshals, Danimarca',

      point: {
        lat: 57.596364,
        lng: 9.973799,
      },
    },

    arrivalPort: {
      name: 'Kristiansand',
      country: 'Norvegia',

      terminalName:
        'Kristiansand fergeterminal',

      address:
        'Vestre Strandgate 31, 4611 Kristiansand S, Norvegia',

      point: {
        lat: 58.14412,
        lng: 7.985212,
      },
    },

    durationMinutes: 235,
    distanceKm: 135,
    motorcycleAllowed: true,
    yearRound: true,

    notes:
      'Traversata con cruise ferry. Esistono anche servizi veloci stagionali.',
  },
]

function toRadians(
  value: number,
) {
  return (
    value *
    Math.PI /
    180
  )
}

function distanceKm(
  first: RoutePoint,
  second: RoutePoint,
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

function buildCandidate(
  start: RoutePoint,
  destination: RoutePoint,
  connection: FerryConnection,
  reversed: boolean,
): FerryCandidate {
  const departurePort =
    reversed
      ? connection.arrivalPort
      : connection.departurePort

  const arrivalPort =
    reversed
      ? connection.departurePort
      : connection.arrivalPort

  const distanceToDepartureKm =
    distanceKm(
      start,
      departurePort.point,
    )

  const distanceFromArrivalKm =
    distanceKm(
      arrivalPort.point,
      destination,
    )

  return {
    connection,
    reversed,
    departurePort,
    arrivalPort,

    distanceToDepartureKm,
    distanceFromArrivalKm,

    scoreKm:
      distanceToDepartureKm +
      distanceFromArrivalKm,
  }
}

export function findFerryCandidates(
  start: RoutePoint,
  destination: RoutePoint,
): FerryCandidate[] {
  return FERRY_CONNECTIONS
    .filter(
      (connection) =>
        connection
          .motorcycleAllowed,
    )
    .flatMap(
      (connection) => [
        buildCandidate(
          start,
          destination,
          connection,
          false,
        ),

        buildCandidate(
          start,
          destination,
          connection,
          true,
        ),
      ],
    )
    .filter(
      (candidate) =>
        candidate
          .distanceToDepartureKm <=
          MAX_APPROACH_KM &&
        candidate
          .distanceFromArrivalKm <=
          MAX_EXIT_KM,
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.scoreKm -
        second.scoreKm,
    )
}

export function proposeFerry(
  start: RoutePoint,
  destination: RoutePoint,
  allowFerries: boolean,
): FerryProposal {
  if (!allowFerries) {
    return {
      type: 'road',
      reason:
        'Traghetti disattivati nelle preferenze viaggio.',
    }
  }

  const candidates =
    findFerryCandidates(
      start,
      destination,
    )

  const bestCandidate =
    candidates[0]

  if (!bestCandidate) {
    return {
      type: 'road',
      reason:
        'Nessun collegamento marittimo compatibile rilevato.',
    }
  }

  return {
    type: 'ferry',
    candidate:
      bestCandidate,
  }
}

export function getFerryConnections() {
  return [
    ...FERRY_CONNECTIONS,
  ]
}
