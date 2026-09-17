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

export type TripDay = {
  id: string
  dayNumber: number
  dateLabel: string
  steps: TripDayStep[]
  notes: string[]
}
