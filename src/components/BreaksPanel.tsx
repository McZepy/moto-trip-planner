import {
  useMemo,
  useState,
} from 'react'

import {
  reverseLookupLocalityPoint,
} from '../providers/autocompleteProvider'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  plannedStopPoints,
} from '../itinerary/serviceStopPlanner'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  TripServiceStop,
} from '../types/serviceStop'

import './BreaksPanel.css'

type BreaksPanelProps = {
  routePlan:
    TripRoutePlan | null
  selectedDayId?:
    string | null
  days:
    TripDay[]
  stops:
    TripServiceStop[]
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

function createId() {
  if (
    typeof crypto !==
      'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID()
  }

  return (
    'break-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  )
}

export function BreaksPanel({
  routePlan,
  selectedDayId,
  days,
  stops,
  onChange,
  onStatus,
}: BreaksPanelProps) {
  const [
    intervalKm,
    setIntervalKm,
  ] =
    useState(
      150,
    )

  const [
    durationMinutes,
    setDurationMinutes,
  ] =
    useState(
      15,
    )

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    )

  const scopeDay =
    selectedDayId
      ? days.find(
          (
            day,
          ) =>
            day.id ===
            selectedDayId,
        )
      : undefined

  const scopeLabel =
    scopeDay
      ? `Giorno ${scopeDay.dayNumber}`
      : 'Percorso visualizzato'

  const scopeStops =
    useMemo(
      () =>
        stops.filter(
          (
            stop,
          ) =>
            stop.kind ===
              'break' &&
            (
              stop.dayId ??
              null
            ) ===
              (
                selectedDayId ??
                null
              ),
        ),
      [
        stops,
        selectedDayId,
      ],
    )

  const handleGenerate =
    async () => {
      if (!routePlan) {
        onStatus?.(
          'Prima visualizza un percorso da pianificare.',
        )
        return
      }

      setBusy(
        true,
      )

      try {
        const targets =
          plannedStopPoints(
            routePlan,
            intervalKm,
            45,
          )

        const generated:
          TripServiceStop[] = []

        for (
          let index =
            0;
          index <
            targets.length;
          index +=
            1
        ) {
          const target =
            targets[
              index
            ]

          let name =
            `Pausa km ${target.routeKm.toFixed(0)}`

          let label =
            'Punto lungo il percorso'

          try {
            const place =
              await reverseLookupLocalityPoint(
                target.point,
              )

            name =
              place.name

            label =
              place.label
          } catch {
            // Mantiene il punto grezzo.
          }

          generated.push({
            id:
              createId(),

            kind:
              'break',

            dayId:
              selectedDayId ??
              undefined,

            dayNumber:
              scopeDay
                ?.dayNumber,

            routeKm:
              target.routeKm,

            name,

            label,

            lat:
              target.point.lat,

            lng:
              target.point.lng,

            durationMinutes,

            source:
              'automatic',
          })
        }

        const preserved =
          stops.filter(
            (
              stop,
            ) =>
              !(
                stop.kind ===
                  'break' &&
                (
                  stop.dayId ??
                    null
                ) ===
                  (
                    selectedDayId ??
                    null
                  )
              ),
          )

        onChange([
          ...preserved,
          ...generated,
        ])

        onStatus?.(
          generated.length >
            0
            ? `${generated.length} pause relax pianificate per ${scopeLabel}.`
            : `Nessuna pausa intermedia necessaria per ${scopeLabel}.`,
        )
      } catch (
        error
      ) {
        console.error(
          error,
        )

        onStatus?.(
          error instanceof Error
            ? error.message
            : 'Errore durante la pianificazione delle pause.',
        )
      } finally {
        setBusy(
          false,
        )
      }
    }

  const clearScope =
    () => {
      onChange(
        stops.filter(
          (
            stop,
          ) =>
            !(
              stop.kind ===
                'break' &&
              (
                stop.dayId ??
                  null
              ) ===
                (
                  selectedDayId ??
                  null
                )
            ),
        ),
      )
    }

  return (
    <section className="breaks-panel">
      <div className="service-panel-card">
        <strong>
          Pause relax · {scopeLabel}
        </strong>

        <p>
          Inserisci una pausa regolare lungo la traccia. Sono punti di comfort: non modificano il percorso finché non li rendiamo soste obbligatorie.
        </p>

        <div className="service-panel-grid">
          <label>
            <span>
              Pausa ogni
            </span>

            <div className="service-number-row">
              <input
                type="number"
                min="60"
                max="300"
                step="10"
                value={
                  intervalKm
                }
                onChange={(
                  event,
                ) =>
                  setIntervalKm(
                    Math.max(
                      60,
                      Math.min(
                        300,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          150,
                      ),
                    ),
                  )
                }
              />

              <small>
                km
              </small>
            </div>
          </label>

          <label>
            <span>
              Durata pausa
            </span>

            <div className="service-number-row">
              <input
                type="number"
                min="5"
                max="90"
                step="5"
                value={
                  durationMinutes
                }
                onChange={(
                  event,
                ) =>
                  setDurationMinutes(
                    Math.max(
                      5,
                      Math.min(
                        90,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          15,
                      ),
                    ),
                  )
                }
              />

              <small>
                min
              </small>
            </div>
          </label>
        </div>

        <div className="service-panel-actions">
          <button
            type="button"
            className="service-primary"
            disabled={
              busy
            }
            onClick={() =>
              void handleGenerate()
            }
          >
            {busy
              ? 'Creo pause...'
              : 'Pianifica pause'}
          </button>

          {scopeStops.length >
            0 && (
            <button
              type="button"
              onClick={
                clearScope
              }
            >
              Rimuovi soste
            </button>
          )}
        </div>
      </div>

      {scopeStops.length >
        0 && (
        <div className="service-stop-list">
          {scopeStops
            .slice()
            .sort(
              (
                first,
                second,
              ) =>
                first.routeKm -
                second.routeKm,
            )
            .map(
              (
                stop,
                index,
              ) => (
                <div
                  key={
                    stop.id
                  }
                  className="service-stop-card"
                >
                  <span className="service-stop-badge break">
                    P{index + 1}
                  </span>

                  <div>
                    <strong>
                      {stop.name}
                    </strong>

                    <span>
                      circa km {stop.routeKm.toFixed(0)}
                      {' · '}
                      {stop.durationMinutes ?? 15} min
                    </span>

                    <small>
                      {stop.label}
                    </small>
                  </div>
                </div>
              ),
            )}
        </div>
      )}
    </section>
  )
}
