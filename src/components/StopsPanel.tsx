import {
  useMemo,
  useState,
} from 'react'

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

import { EditableNumberInput } from './EditableNumberInput'

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

function stopKindLabel(
  stop:
    TripServiceStop,
) {
  if (
    stop.kind ===
      'fuel' &&
    stop.relaxMinutes
  ) {
    return 'Carburante + pausa'
  }

  if (
    stop.kind ===
    'fuel'
  ) {
    return 'Rifornimento'
  }

  return 'Pausa'
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
  const [
    openStopId,
    setOpenStopId,
  ] =
    useState<
      string | null
    >(null)

  const [
    plannerOpen,
    setPlannerOpen,
  ] =
    useState(
      false,
    )

  const orderedStops =
    useMemo(
      () =>
        stops
          .slice()
          .sort(
            (
              first,
              second,
            ) => {
              const firstDay =
                first.dayNumber ??
                999

              const secondDay =
                second.dayNumber ??
                999

              if (
                firstDay !==
                secondDay
              ) {
                return (
                  firstDay -
                  secondDay
                )
              }

              return (
                first.routeKm -
                second.routeKm
              )
            },
          ),
      [
        stops,
      ],
    )

  const updateStopDuration =
    (
      stop:
        TripServiceStop,
      value:
        number,
    ) => {
      onChange(
        stops.map(
          (
            item,
          ) =>
            item.id ===
              stop.id
              ? stop.kind ===
                    'fuel' &&
                  stop.relaxMinutes
                ? {
                    ...item,

                    relaxMinutes:
                      value,
                  }
                : {
                    ...item,

                    durationMinutes:
                      value,
                  }
              : item,
        ),
      )
    }

  const removeStop =
    (
      stopId:
        string,
    ) => {
      onChange(
        stops.filter(
          (
            stop,
          ) =>
            stop.id !==
            stopId,
        ),
      )

      setOpenStopId(
        null,
      )
    }

  return (
    <section className="stops-panel">
      <div className="stops-recap-heading">
        <div>
          <strong>
            Riepilogo soste
          </strong>

          <span>
            {orderedStops.length} {orderedStops.length === 1 ? 'sosta' : 'soste'} nel viaggio
          </span>
        </div>
      </div>

      {orderedStops.length ===
        0 ? (
        <div className="stops-empty-line">
          Nessuna sosta ancora pianificata.
        </div>
      ) : (
        <div className="stops-strip-list">
          {orderedStops.map(
            (
              stop,
              index,
            ) => {
              const open =
                openStopId ===
                stop.id

              const sameKindBefore =
                orderedStops
                  .slice(
                    0,
                    index,
                  )
                  .filter(
                    (
                      item,
                    ) =>
                      item.kind ===
                      stop.kind,
                  )
                  .length

              const badge =
                stop.kind ===
                  'fuel'
                  ? stop.relaxMinutes
                    ? 'F+P'
                    : `F${sameKindBefore + 1}`
                  : `P${sameKindBefore + 1}`

              const dayLabel =
                stop.dayNumber
                  ? `Giorno ${stop.dayNumber}`
                  : 'Viaggio'

              return (
                <div
                  key={
                    stop.id
                  }
                  className="stops-strip-wrap"
                >
                  <button
                    type="button"
                    className="stops-strip"
                    onClick={() =>
                      setOpenStopId(
                        open
                          ? null
                          : stop.id,
                      )
                    }
                  >
                    <span
                      className={
                        stop.kind ===
                          'fuel'
                          ? 'stops-strip-badge fuel'
                          : 'stops-strip-badge break'
                      }
                    >
                      {badge}
                    </span>

                    <span className="stops-strip-main">
                      <strong>
                        {dayLabel}: {stop.name}
                      </strong>

                      <small>
                        {stopKindLabel(
                          stop,
                        )}
                        {' · '}
                        km {stop.routeKm.toFixed(0)}
                        {stop.deviationKm !==
                          undefined
                          ? ` · deviazione ~${stop.deviationKm.toFixed(1)} km`
                          : ''}
                      </small>
                    </span>

                    <span className="stops-strip-menu">
                      {open
                        ? '⌃'
                        : '⋮'}
                    </span>
                  </button>

                  {open && (
                    <div className="stops-strip-panel">
                      <div className="stops-strip-detail">
                        <span>
                          {stopKindLabel(
                            stop,
                          )}
                        </span>

                        <strong>
                          {stop.name}
                        </strong>

                        <small>
                          {stop.label}
                        </small>
                      </div>

                      <label className="stops-strip-duration">
                        <span>
                          Durata sosta
                        </span>

                        <div>
                          <EditableNumberInput
                            min={5}
                            max={120}
                            step={5}
                            fallback={10}
                            value={
                              stop.kind ===
                                  'fuel' &&
                                stop.relaxMinutes
                                ? stop.relaxMinutes
                                : stop.durationMinutes ??
                                  10
                            }
                            onCommit={(
                              value,
                            ) =>
                              updateStopDuration(
                                stop,
                                value ??
                                  10,
                              )
                            }
                          />

                          <b>
                            min
                          </b>
                        </div>
                      </label>

                      {stop.estimatedCostEur !==
                        undefined && (
                        <div className="stops-strip-cost">
                          Costo carburante stimato: <strong>€ {stop.estimatedCostEur.toFixed(2)}</strong>
                        </div>
                      )}

                      <button
                        type="button"
                        className="stops-strip-remove"
                        onClick={() =>
                          removeStop(
                            stop.id,
                          )
                        }
                      >
                        Rimuovi questa sosta
                      </button>
                    </div>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}

      <button
        type="button"
        className="stops-planner-toggle"
        onClick={() =>
          setPlannerOpen(
            (
              current,
            ) =>
              !current,
          )
        }
      >
        <span>
          <strong>
            Pianifica / modifica soste
          </strong>

          <small>
            carburante · pause · pranzo
          </small>
        </span>

        <span>
          {plannerOpen
            ? '⌃'
            : '⋮'}
        </span>
      </button>

      {plannerOpen && (
        <div className="stops-planner-panel">
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
        </div>
      )}
    </section>
  )
}
