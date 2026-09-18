import {
  useMemo,
  useState,
} from 'react'

import {
  searchNearbyRestFacilities,
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

function scopeMatches(
  stop:
    TripServiceStop,
  selectedDayId?:
    string | null,
) {
  return (
    stop.dayId ??
    null
  ) ===
    (
      selectedDayId ??
      null
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
            scopeMatches(
              stop,
              selectedDayId,
            ) &&
            (
              stop.kind ===
                'break' ||
              (
                stop.kind ===
                  'fuel' &&
                Boolean(
                  stop.relaxMinutes,
                )
              )
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
            45,
          )

        /*
         * Rigeneriamo solo le pause dello scope corrente.
         * I rifornimenti restano e possono diventare soste combinate.
         */
        const baseStops =
          stops
            .filter(
              (
                stop,
              ) =>
                !(
                  stop.kind ===
                    'break' &&
                  scopeMatches(
                    stop,
                    selectedDayId,
                  )
                ),
            )
            .map(
              (
                stop,
              ) =>
                stop.kind ===
                  'fuel' &&
                scopeMatches(
                  stop,
                  selectedDayId,
                )
                  ? {
                      ...stop,
                      relaxMinutes:
                        undefined,
                    }
                  : {
                      ...stop,
                    },
            )

        const fuelStops =
          baseStops.filter(
            (
              stop,
            ) =>
              stop.kind ===
                'fuel' &&
              scopeMatches(
                stop,
                selectedDayId,
              ),
          )

        const generated:
          TripServiceStop[] = []

        const nextWarnings:
          string[] = []

        let mergedCount =
          0

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

          const nearbyFuel =
            fuelStops
              .filter(
                (
                  stop,
                ) =>
                  Math.abs(
                    stop.routeKm -
                    target.routeKm,
                  ) <=
                  flexibilityKm,
              )
              .sort(
                (
                  first,
                  second,
                ) =>
                  Math.abs(
                    first.routeKm -
                    target.routeKm,
                  ) -
                  Math.abs(
                    second.routeKm -
                    target.routeKm,
                  ),
              )[0]

          if (nearbyFuel) {
            nearbyFuel.relaxMinutes =
              durationMinutes

            mergedCount +=
              1

            continue
          }

          const searchRadiusMeters =
            (
              flexibilityKm +
              maxDeviationKm +
              2
            ) *
            1000

          const candidates =
            await searchNearbyRestFacilities(
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

                  const preferredType =
                    [
                      'services',
                      'cafe',
                      'restaurant',
                      'fast_food',
                    ].includes(
                      candidate.type ??
                        '',
                    )

                  const score =
                    deviationKm *
                      12 +
                    alongDifference +
                    (
                      preferredType
                        ? 0
                        : 4
                    )

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
              `Km ${target.routeKm.toFixed(0)}: nessuna area servizi/caffè trovata entro ±${flexibilityKm} km e ${maxDeviationKm} km dalla traccia.`,
            )

            continue
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

            durationMinutes,

            source:
              'locationiq',
          })
        }

        onChange([
          ...baseStops,
          ...generated,
        ])

        setWarnings(
          nextWarnings,
        )

        const parts:
          string[] = []

        if (
          mergedCount >
          0
        ) {
          parts.push(
            `${mergedCount} ${mergedCount === 1 ? 'pausa unita' : 'pause unite'} ai rifornimenti`,
          )
        }

        if (
          generated.length >
          0
        ) {
          parts.push(
            `${generated.length} ${generated.length === 1 ? 'area pausa trovata' : 'aree pausa trovate'}`,
          )
        }

        onStatus?.(
          parts.length >
            0
            ? `${scopeLabel}: ${parts.join(' · ')}.`
            : `Nessuna area pausa compatibile trovata per ${scopeLabel}.`,
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
        stops
          .filter(
            (
              stop,
            ) =>
              !(
                stop.kind ===
                  'break' &&
                scopeMatches(
                  stop,
                  selectedDayId,
                )
              ),
          )
          .map(
            (
              stop,
            ) =>
              stop.kind ===
                'fuel' &&
              scopeMatches(
                stop,
                selectedDayId,
              )
                ? {
                    ...stop,
                    relaxMinutes:
                      undefined,
                  }
                : stop,
          ),
      )

      setWarnings(
        [],
      )
    }

  return (
    <section className="breaks-panel">
      <div className="service-panel-card">
        <strong>
          Pause relax · {scopeLabel}
        </strong>

        <p>
          MotoRoute cerca aree servizi, caffè o ristoro vicino alla traccia. Se una pausa cade entro la flessibilità di un rifornimento già pianificato, usa quel rifornimento come unica sosta.
        </p>

        <div className="service-panel-grid four">
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
              Durata
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
              ? 'Cerco aree pausa...'
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
              Rimuovi pause
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
              ) => {
                const combined =
                  stop.kind ===
                    'fuel'

                return (
                  <div
                    key={
                      stop.id
                    }
                    className="service-stop-card"
                  >
                    <span
                      className={
                        combined
                          ? 'service-stop-badge combined'
                          : 'service-stop-badge break'
                      }
                    >
                      {combined
                        ? 'F+P'
                        : `P${index + 1}`}
                    </span>

                    <div>
                      <strong>
                        {stop.name}
                      </strong>

                      <span>
                        circa km {stop.routeKm.toFixed(0)}
                        {' · '}
                        {combined
                          ? `carburante + relax ${stop.relaxMinutes ?? durationMinutes} min`
                          : `relax ${stop.durationMinutes ?? durationMinutes} min`}
                        {stop.deviationKm !==
                          undefined
                          ? ` · deviazione ~${stop.deviationKm.toFixed(1)} km`
                          : ''}
                      </span>

                      <small>
                        {stop.label}
                      </small>
                    </div>
                  </div>
                )
              },
            )}
        </div>
      )}
    </section>
  )
}
