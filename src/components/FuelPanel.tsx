import {
  useMemo,
  useState,
} from 'react'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  roadDistanceMeters,
} from '../itinerary/routeDaySplitter'

import {
  planFuelStopsForTrip,
} from '../itinerary/tripServiceStopPlanner'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  TripSettings,
} from '../types/trip'

import type {
  ServiceStopPlanningSettings,
  TripServiceStop,
} from '../types/serviceStop'

import { EditableNumberInput } from './EditableNumberInput'

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

  planningSettings:
    ServiceStopPlanningSettings

  onPlanningSettingsChange:
    (
      settings:
        ServiceStopPlanningSettings,
    ) => void

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
  planningSettings,
  onPlanningSettingsChange,
  onChange,
  onStatus,
}: FuelPanelProps) {
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
        const result =
          await planFuelStopsForTrip({
            routePlan,
            selectedDayId,
            days,
            stops,
            tripSettings:
              settings,
            planningSettings,
          })

        onChange(
          result.stops,
        )

        setWarnings(
          result.warnings,
        )

        onStatus?.(
          result.generatedCount >
            0
            ? `${result.generatedCount} rifornimenti pianificati per ${scopeLabel} con ripartenza dell’autonomia a ogni inizio giornata${result.mergedCount > 0 ? ` · ${result.mergedCount} pause unite ai rifornimenti` : ''}.`
            : `Nessun rifornimento intermedio necessario o compatibile per ${scopeLabel}.`,
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
          Autonomia {settings.vehicleRangeKm} km · margine sicurezza {settings.fuelSafetyMarginKm} km · ogni giornata parte con il pieno e il conteggio dell’autonomia riparte da zero.
        </p>

        <div className="service-panel-grid">
          <label>
            <span>
              Flessibilità lungo rotta
            </span>

            <div className="service-number-row">
              <EditableNumberInput
                min={5}
                max={40}
                step={5}
                fallback={20}
                value={
                  planningSettings
                    .fuelFlexibilityKm
                }
                onCommit={(
                  value,
                ) =>
                  onPlanningSettingsChange({
                    ...planningSettings,
                    fuelFlexibilityKm:
                      value ??
                      20,
                  })
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
              <EditableNumberInput
                min={0.5}
                max={5}
                step={0.5}
                fallback={2}
                value={
                  planningSettings
                    .fuelMaxDeviationKm
                }
                onCommit={(
                  value,
                ) =>
                  onPlanningSettingsChange({
                    ...planningSettings,
                    fuelMaxDeviationKm:
                      value ??
                      2,
                  })
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

    </section>
  )
}