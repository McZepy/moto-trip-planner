export type TripDurationMode =
  | 'single-day'
  | 'multi-day'

export type TripShape =
  | 'one-way'
  | 'round-trip'
  | 'loop'

export type RouteStyle =
  | 'fast'
  | 'scenic'
  | 'mixed'
  | 'curvy'
  | 'relax'

export type TripRoadPreferences = {
  pavedOnly: boolean
  avoidUnpaved: boolean
  avoidMotorways: boolean
  avoidTolls: boolean
  avoidDifficultRoads: boolean
}

export type TripSettings = {
  durationMode: TripDurationMode

  shape: TripShape

  departureDate: string
  departureTime: string

  plannedDays: number | null

  routeStyle: RouteStyle

  roadPreferences: TripRoadPreferences
}

export const defaultTripSettings: TripSettings = {
  durationMode: 'single-day',

  shape: 'one-way',

  departureDate: '',
  departureTime: '',

  plannedDays: null,

  routeStyle: 'fast',

  roadPreferences: {
    pavedOnly: true,
    avoidUnpaved: true,
    avoidMotorways: false,
    avoidTolls: false,
    avoidDifficultRoads: true,
  },
}

export const routeStyleLabels: Record<
  RouteStyle,
  string
> = {
  fast: 'Veloce',
  scenic: 'Panoramico',
  mixed: 'Misto',
  curvy: 'Curve',
  relax: 'Relax',
}

export const tripShapeLabels: Record<
  TripShape,
  string
> = {
  'one-way': 'Solo andata',
  'round-trip': 'Andata e ritorno',
  loop: 'Tour ad anello',
}

export const tripDurationLabels: Record<
  TripDurationMode,
  string
> = {
  'single-day': 'In giornata',
  'multi-day': 'Più giorni',
}