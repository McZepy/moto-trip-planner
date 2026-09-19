import {
  useMemo,
  useState,
} from 'react'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  planBreakStopsForTrip,
} from '../itinerary/tripServiceStopPlanner'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  ServiceStopPlanningSettings,
  TripServiceStop,
} from '../types/serviceStop'

import { EditableNumberInput } from './EditableNumberInput'

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
  planningSettings,
  onPlanningSettingsChange,
  onChange,
  onStatus,
}: BreaksPanelProps) {
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
        const result =
          await planBreakStopsForTrip({
            routePlan,
            selectedDayId,
            days,
            stops,
            planningSettings,
          })

        onChange(
          result.stops,
        )

        setWarnings(
          result.warnings,
        )

        const parts:
          string[] = []

        if (
          result.mergedCount >
          0
        ) {
          parts.push(
            `${result.mergedCount} ${result.mergedCount === 1 ? 'pausa unita' : 'pause unite'} ai rifornimenti`,
          )
        }

        if (
          result.generatedCount >
          0
        ) {
          parts.push(
            `${result.generatedCount} ${result.generatedCount === 1 ? 'area pausa trovata' : 'aree pausa trovate'}`,
          )
        }

        onStatus?.(
          parts.length >
          0
            ? `${scopeLabel}: ${parts.join(' · ')}. Le pause ripartono dall’inizio di ogni giornata.`
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
          MotoRoute cerca aree servizi, caffè o ristoro vicino alla traccia. Il conteggio delle pause riparte da ogni nuova giornata; se una pausa è vicina a un rifornimento, usa una sola sosta.
        </p>

        <div className="service-panel-grid four">
          <label>
            <span>
              Pausa ogni
            </span>

            <div className="service-number-row">
              <EditableNumberInput
                min={60}
                max={300}
                step={10}
                fallback={150}
                value={
                  planningSettings
                    .breakIntervalKm
                }
                onCommit={(
                  value,
                ) =>
                  onPlanningSettingsChange({
                    ...planningSettings,
                    breakIntervalKm:
                      value ??
                      150,
                  })
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
              <EditableNumberInput
                min={5}
                max={90}
                step={5}
                fallback={15}
                value={
                  planningSettings
                    .breakDurationMinutes
                }
                onCommit={(
                  value,
                ) =>
                  onPlanningSettingsChange({
                    ...planningSettings,
                    breakDurationMinutes:
                      value ??
                      15,
                  })
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
              <EditableNumberInput
                min={5}
                max={40}
                step={5}
                fallback={20}
                value={
                  planningSettings
                    .breakFlexibilityKm
                }
                onCommit={(
                  value,
                ) =>
                  onPlanningSettingsChange({
                    ...planningSettings,
                    breakFlexibilityKm:
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
                min={1}
                max={5}
                step={0.5}
                fallback={2}
                value={
                  planningSettings
                    .breakMaxDeviationKm
                }
                onCommit={(
                  value,
                ) =>
                  onPlanningSettingsChange({
                    ...planningSettings,
                    breakMaxDeviationKm:
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

    </section>
  )
}