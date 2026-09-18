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
  roadDistanceMeters,
  roadKmAtPoint,
} from '../itinerary/routeDaySplitter'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  TripSettings,
} from '../types/trip'

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
    (
      value:
        number,
    ) =>
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
  settings,
  onChange,
  onStatus,
}: FuelPanelProps) {
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

  const safeFuelKm =
    Math.max(
      50,
      settings
        .vehicleRangeKm -
        settings
          .fuelSafetyMarginKm,
    )

  const totalRoadKm =
    routePlan
      ? roadDistanceMeters(
          routePlan,
        ) /
        1000
      : 0

  const estimatedTotalCost =
    settings.kmPerLiter &&
    settings.fuelPricePerLiter &&
    totalRoadKm >
      0
      ? (
          totalRoadKm /
          settings.kmPerLiter
        ) *
        settings
          .fuelPricePerLiter
      : null

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
            safeFuelKm,
            Math.max(
              30,
              settings
                .fuelSafetyMarginKm,
            ),
          )

        const generated:
          TripServiceStop[] = []

        const nextWarnings:
          string[] = []

        let previousFuelKm =
          0

        for (
          const target
          of targets
        ) {
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

                  return {
                    candidate,
                    routeKm,
                    deviationKm,

                    score:
                      deviationKm *
                        12 +
                      alongDifference,
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

          const segmentKm =
            Math.max(
              0,
              best.routeKm -
                previousFuelKm,
            )

          const estimatedCostEur =
            settings.kmPerLiter &&
            settings.fuelPricePerLiter
              ? (
                  segmentKm /
                  settings.kmPerLiter
                ) *
                settings
                  .fuelPricePerLiter
              : undefined

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

            estimatedCostEur,

            source:
              'locationiq',
          })

          previousFuelKm =
            best.routeKm
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
            ? `${generated.length} rifornimenti pianificati per ${scopeLabel} con soglia prudenziale ${safeFuelKm} km.`
            : `Nessun rifornimento intermedio compatibile trovato per ${scopeLabel}.`,
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
          Autonomia {settings.vehicleRangeKm} km · margine sicurezza {settings.fuelSafetyMarginKm} km · rifornimento cercato entro circa {safeFuelKm} km dal pieno precedente.
        </p>

        <div className="service-panel-grid">
          <label>
            <span>
              Flessibilità lungo rotta
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
                min="0.5"
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
                      0.5,
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

        {estimatedTotalCost !==
          null && (
          <div className="service-cost-estimate">
            Carburante stimato sul percorso visualizzato: <strong>€ {estimatedTotalCost.toFixed(2)}</strong>
            <small>
              stima su {settings.kmPerLiter?.toFixed(1)} km/l e € {settings.fuelPricePerLiter?.toFixed(2)}/l
            </small>
          </div>
        )}

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
              Rimuovi rifornimenti
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
                      km {stop.routeKm.toFixed(0)}
                      {' · '}
                      deviazione ~{(stop.deviationKm ?? 0).toFixed(1)} km
                      {' · '}
                      {stop.relaxMinutes
                        ? `carburante + relax ${stop.relaxMinutes} min`
                        : 'rifornimento'}
                    </span>

                    {stop.estimatedCostEur !==
                      undefined && (
                      <span>
                        consumo stimato dal precedente pieno: € {stop.estimatedCostEur.toFixed(2)}
                      </span>
                    )}

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
