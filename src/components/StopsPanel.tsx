import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  TripServiceStop,
} from '../types/serviceStop'

import type {
  TripSettings,
} from '../types/trip'

import {
  FuelPanel,
} from './FuelPanel'

import {
  BreaksPanel,
} from './BreaksPanel'

import './StopsPanel.css'

type StopsPanelProps = {
  routePlan:
    TripRoutePlan | null

  selectedDayId?:
    string | null

  days:
    TripDay[]

  stops:
    TripServiceStop[]

  settings:
    TripSettings

  onChange:
    (
      stops:
        TripServiceStop[],
    ) => void

  onStatus?:
    (
      message:
        string,
    ) => void
}

export function StopsPanel({
  routePlan,
  selectedDayId,
  days,
  stops,
  settings,
  onChange,
  onStatus,
}: StopsPanelProps) {
  return (
    <section className="stops-panel">
      <div className="stops-panel-intro">
        <strong>
          Pianificazione soste
        </strong>

        <span>
          Prima pianifica i rifornimenti in base all’autonomia. Poi aggiungi le pause comfort: quando una pausa cade vicino a un rifornimento, MotoRoute le unisce in una sola sosta.
        </span>
      </div>

      <FuelPanel
        routePlan={
          routePlan
        }
        selectedDayId={
          selectedDayId
        }
        days={
          days
        }
        stops={
          stops
        }
        settings={
          settings
        }
        onChange={
          onChange
        }
        onStatus={
          onStatus
        }
      />

      <BreaksPanel
        routePlan={
          routePlan
        }
        selectedDayId={
          selectedDayId
        }
        days={
          days
        }
        stops={
          stops
        }
        onChange={
          onChange
        }
        onStatus={
          onStatus
        }
      />
    </section>
  )
}
