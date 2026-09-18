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
    radiusKm,
    setRadiusKm,
  ] =
    useState(
      12,
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

      try {
        const targets =
          plannedStopPoints(
            routePlan,
            intervalKm,
            60,
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

          const candidates =
            await searchNearbyFuelStations(
              target.point,
              radiusKm *
                1000,
            )

          const nearest =
            [...candidates]
              .sort(
                (
                  first,
                  second,
                ) =>
                  distanceMeters(
                    target.point,
                    first,
                  ) -
                  distanceMeters(
                    target.point,
                    second,
                  ),
              )[0]

          if (nearest) {
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
                target.routeKm,

              name:
                nearest.name,

              label:
                nearest.label,

              lat:
                nearest.lat,

              lng:
                nearest.lng,

              durationMinutes:
                10,

              source:
                'locationiq',
            })

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
              target.routeKm,

            name:
              'Zona rifornimento da verificare',

            label:
              `Nessun distributore trovato entro ${radiusKm} km dal punto previsto.`,

            lat:
              target.point.lat,

            lng:
              target.point.lng,

            durationMinutes:
              10,

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

        onStatus?.(
          generated.length >
            0
            ? `${generated.length} soste carburante pianificate per ${scopeLabel}.`
            : `Nessun rifornimento intermedio necessario per ${scopeLabel}.`,
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
    }

  return (
    <section className="fuel-panel">
      <div className="service-panel-card">
        <strong>
          Rifornimenti · {scopeLabel}
        </strong>

        <p>
          Imposta la distanza massima desiderata tra i rifornimenti. MotoRoute cerca distributori vicini alla traccia senza cambiare il percorso.
        </p>

        <div className="service-panel-grid">
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
              Ricerca entro
            </span>

            <div className="service-number-row">
              <input
                type="number"
                min="2"
                max="30"
                step="1"
                value={
                  radiusKm
                }
                onChange={(
                  event,
                ) =>
                  setRadiusKm(
                    Math.max(
                      2,
                      Math.min(
                        30,
                        Number(
                          event
                            .target
                            .value,
                        ) ||
                          12,
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
                      pausa {stop.durationMinutes ?? 10} min
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
