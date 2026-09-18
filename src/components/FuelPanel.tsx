import {
  useMemo,
  useState,
} from 'react'

import {
  searchNearbyFuelStations,
} from '../providers/autocompleteProvider'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  plannedStopPoints,
} from '../itinerary/serviceStopPlanner'

import {
  pointAtRoadDistance,
  roadKmAtPoint,
} from '../itinerary/routeDaySplitter'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  TripServiceStop,
} from '../types/serviceStop'

import './FuelPanel.css'

type FuelPanelProps = {
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
    'fuel-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  )
}

function distanceMeters(
  a: {
    lat: number
    lng: number
  },
  b: {
    lat: number
    lng: number
  },
) {
  const toRad =
    (value: number) =>
      value *
      Math.PI /
      180

  const earthRadius =
    6_371_000

  const lat1 =
    toRad(
      a.lat,
    )

  const lat2 =
    toRad(
      b.lat,
    )

  const deltaLat =
    toRad(
      b.lat -
      a.lat,
    )

  const deltaLng =
    toRad(
      b.lng -
      a.lng,
    )

  const h =
    Math.sin(
      deltaLat /
      2,
    ) ** 2 +
    Math.cos(
      lat1,
    ) *
      Math.cos(
        lat2,
      ) *
      Math.sin(
        deltaLng /
        2,
      ) ** 2

  return (
    2 *
    earthRadius *
    Math.atan2(
      Math.sqrt(
        h,
      ),
      Math.sqrt(
        1 -
        h,
      ),
    )
  )
}

export function FuelPanel({
  routePlan,
  selectedDayId,
  days,
  stops,
  onChange,
  onStatus,
}: FuelPanelProps) {
  const [
    intervalKm,
    setIntervalKm,
  ] =
    useState(
      250,
    )

  const [
    flexibilityKm,
    setFlexibilityKm,
  ] =
    useState(
      20,
    )

  const [
    maxDeviationKm,
    setMaxDeviationKm,
  ] =
    useState(
      2,
    )

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    )

  const [
    warnings,
    setWarnings,
  ] =
    useState<
      string[]
    >([])

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
              'fuel' &&
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

      setWarnings(
        [],
      )

      try {
        const targets =
          plannedStopPoints(
            routePlan,
            intervalKm,
            60,
          )

        const generated:
          TripServiceStop[] = []

        const nextWarnings:
          string[] = []

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

          /*
           * Un'unica ricerca ampia serve solo a raccogliere i POI.
           * Poi il filtro geometrico accetta esclusivamente stazioni
           * vicine alla traccia e dentro la finestra chilometrica.
           */
          const searchRadiusMeters =
            (
              flexibilityKm +
              maxDeviationKm +
              2
            ) *
            1000

          const candidates =
            await searchNearbyFuelStations(
              target.point,
              searchRadiusMeters,
            )

          const ranked =
            candidates
              .map(
                (
                  candidate,
                ) => {
                  const routeKm =
                    roadKmAtPoint(
                      routePlan,
                      candidate,
                    )

                  if (
                    routeKm ===
                    null
                  ) {
                    return null
                  }

                  const projected =
                    pointAtRoadDistance(
                      routePlan,
                      routeKm *
                        1000,
                    )

                  if (!projected) {
                    return null
                  }

                  const deviationKm =
                    distanceMeters(
                      candidate,
                      projected.point,
                    ) /
                    1000

                  const alongDifference =
                    Math.abs(
                      routeKm -
                      target.routeKm,
                    )

                  if (
                    alongDifference >
                      flexibilityKm ||
                    deviationKm >
                      maxDeviationKm
                  ) {
                    return null
                  }

                  const score =
                    deviationKm *
                      12 +
                    alongDifference

                  return {
                    candidate,
                    routeKm,
                    deviationKm,
                    score,
                  }
                },
              )
              .filter(
                (
                  value,
                ): value is {
                  candidate:
                    typeof candidates[number]
                  routeKm:
                    number
                  deviationKm:
                    number
                  score:
                    number
                } =>
                  value !==
                  null,
              )
              .sort(
                (
                  first,
                  second,
                ) =>
                  first.score -
                  second.score,
              )

          const best =
            ranked[0]

          if (!best) {
            nextWarnings.push(
              `Km ${target.routeKm.toFixed(0)}: nessun distributore trovato entro ±${flexibilityKm} km lungo la rotta e ${maxDeviationKm} km di deviazione.`,
            )

            continue
          }

          generated.push({
            id:
              createId(),

            kind:
              'fuel',

            dayId:
              selectedDayId ??
                undefined,

            dayNumber:
              scopeDay
                ?.dayNumber,

            routeKm:
              best.routeKm,

            deviationKm:
              best.deviationKm,

            name:
              best
                .candidate
                .name,

            label:
              best
                .candidate
                .label,

            lat:
              best
                .candidate
                .lat,

            lng:
              best
                .candidate
                .lng,

            durationMinutes:
              10,

            source:
              'locationiq',
          })
        }

        const preserved =
          stops.filter(
            (
              stop,
            ) =>
              !(
                stop.kind ===
                  'fuel' &&
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

        setWarnings(
          nextWarnings,
        )

        onStatus?.(
          generated.length >
            0
            ? `${generated.length} rifornimenti vicini alla traccia pianificati per ${scopeLabel}.`
            : `Nessun distributore compatibile trovato per ${scopeLabel}.`,
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
            : 'Errore durante la ricerca dei distributori.',
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
                'fuel' &&
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

      setWarnings(
        [],
      )
    }

  return (
    <section className="fuel-panel">
      <div className="service-panel-card">
        <strong>
          Rifornimenti · {scopeLabel}
        </strong>

        <p>
          MotoRoute cerca veri distributori vicino alla traccia. Può anticipare o posticipare il rifornimento entro la flessibilità indicata, ma limita la deviazione laterale.
        </p>

        <div className="service-panel-grid three">
          <label>
            <span>
              Rifornimento ogni
            </span>

            <div className="service-number-row">
              <input
                type="number"
                min="50"
                max="500"
                step="10"
                value={
                  intervalKm
                }
                onChange={(
                  event,
                ) =>
                  setIntervalKm(
                    Math.max(
                      50,
                      Math.min(
                        500,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          250,
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
              Flessibilità
            </span>

            <div className="service-number-row">
              <input
                type="number"
                min="5"
                max="40"
                step="5"
                value={
                  flexibilityKm
                }
                onChange={(
                  event,
                ) =>
                  setFlexibilityKm(
                    Math.max(
                      5,
                      Math.min(
                        40,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          20,
                      ),
                    ),
                  )
                }
              />

              <small>
                ± km
              </small>
            </div>
          </label>

          <label>
            <span>
              Deviazione max
            </span>

            <div className="service-number-row">
              <input
                type="number"
                min="1"
                max="5"
                step="0.5"
                value={
                  maxDeviationKm
                }
                onChange={(
                  event,
                ) =>
                  setMaxDeviationKm(
                    Math.max(
                      1,
                      Math.min(
                        5,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          2,
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
              ? 'Cerco distributori...'
              : 'Pianifica rifornimenti'}
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

        {warnings.length >
          0 && (
          <div className="service-warning-list">
            {warnings.map(
              (
                warning,
              ) => (
                <span
                  key={
                    warning
                  }
                >
                  {warning}
                </span>
              ),
            )}
          </div>
        )}
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
                  <span className="service-stop-badge fuel">
                    F{index + 1}
                  </span>

                  <div>
                    <strong>
                      {stop.name}
                    </strong>

                    <span>
                      circa km {stop.routeKm.toFixed(0)}
                      {' · '}
                      deviazione ~{(stop.deviationKm ?? 0).toFixed(1)} km
                      {' · '}
                      {stop.relaxMinutes
                        ? `carburante + relax ${stop.relaxMinutes} min`
                        : `pausa ${stop.durationMinutes ?? 10} min`}
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
