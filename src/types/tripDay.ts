import type {
  GeocodingResult,
} from '../providers/geocodingProvider'

import type {
  Waypoint,
} from './waypoint'

export type TripDayPlaceStep = {
  kind: 'place'
  name: string
}

export type TripDayFerryStep = {
  kind: 'ferry'
  label: string
}

export type TripDayStep =
  | TripDayPlaceStep
  | TripDayFerryStep

export type TripDayRoutingOverride = {
  startPlace:
    GeocodingResult

  destinationPlace:
    GeocodingResult

  waypoints:
    Waypoint[]
}

export type TripDay = {
  id: string
  dayNumber: number
  dateLabel: string
  steps: TripDayStep[]
  notes: string[]

  /*
   * Quando presente, questa è la versione modificata manualmente
   * dalla pagina "Itinerario & Tappe".
   *
   * Le località intermedie del testo restano descrittive:
   * il routing usa partenza, arrivo e solo i waypoint realmente
   * scelti dall'utente.
   */
  routingOverride?:
    TripDayRoutingOverride
}
