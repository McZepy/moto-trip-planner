import {
  useState,
} from 'react'

import {
  getTripDayFerryLegs,
  getTripDayPlaces,
  parseItineraryText,
} from '../itinerary/itineraryTextParser'

import type {
  TripDayRouteStats,
} from '../itinerary/tripDayRoutePlanner'

import type {
  TripDay,
} from '../types/tripDay'

import './DaysHotelPanel.css'

type DaysHotelPanelProps = {
  days: TripDay[]
  selectedDayId?: string | null
  routeStats?: Record<string, TripDayRouteStats>
  routingBusy?: boolean
  routingProgress?: string | null
  onChange:
    (days: TripDay[]) => void
  onSelectDay?:
    (day: TripDay) => void
  onShowOverview?:
    () => void
  onStatus?:
    (message: string) => void
}

function daySummary(
  day: TripDay,
) {
  const places =
    getTripDayPlaces(day)

  return {
    start:
      places[0] ?? '—',
    destination:
      places.at(-1) ?? '—',
    via:
      places.slice(1, -1),
    ferries:
      getTripDayFerryLegs(day),
  }
}

function formatDistance(
  meters: number,
) {
  return `${(meters / 1000).toFixed(0)} km`
}

function formatDuration(
  seconds: number,
) {
  const totalMinutes =
    Math.round(seconds / 60)

  const hours =
    Math.floor(totalMinutes / 60)

  const minutes =
    totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours} h ${minutes} min`
}

export function DaysHotelPanel({
  days,
  selectedDayId = null,
  routeStats = {},
  routingBusy = false,
  routingProgress = null,
  onChange,
  onSelectDay,
  onShowOverview,
  onStatus,
}: DaysHotelPanelProps) {
  const [
    sourceText,
    setSourceText,
  ] =
    useState('')

  const [
    warnings,
    setWarnings,
  ] =
    useState<string[]>([])

  const handleImport =
    () => {
      const parsed =
        parseItineraryText(
          sourceText,
        )

      setWarnings(
        parsed.warnings,
      )

      if (
        parsed.days.length === 0
      ) {
        onStatus?.(
          'Nessuna giornata riconosciuta nel testo.',
        )
        return
      }

      if (
        days.length > 0 &&
        !window.confirm(
          `Sostituire le ${days.length} giornate attuali con le ${parsed.days.length} giornate appena riconosciute?`,
        )
      ) {
        return
      }

      onChange(
        parsed.days,
      )

      onStatus?.(
        `${parsed.days.length} giornate importate dal testo.`,
      )
    }

  const handleClear =
    () => {
      if (
        days.length > 0 &&
        !window.confirm(
          'Eliminare tutte le giornate importate?',
        )
      ) {
        return
      }

      onChange([])
      setWarnings([])

      onStatus?.(
        'Giornate eliminate.',
      )
    }

  return (
    <section className="days-panel">
      <div className="days-import-card">
        <div className="days-import-heading">
          <div>
            <strong>
              Importa itinerario da testo
            </strong>

            <p>
              Incolla giornate con data e località separate da →. MotoRoute riconosce anche traghetti e note tra parentesi.
            </p>
          </div>

          {days.length > 0 && (
            <span className="days-count-badge">
              {days.length} giornate
            </span>
          )}
        </div>

        <textarea
          className="days-source-textarea"
          value={
            sourceText
          }
          placeholder={
            '1. 24/7\nViganò → Como → ... → Fulda\n\n2. 25/7\nFulda → ... → Schleswig'
          }
          onChange={(
            event,
          ) =>
            setSourceText(
              event.target.value,
            )
          }
        />

        <div className="days-import-actions">
          <button
            type="button"
            className="days-import-primary"
            disabled={
              !sourceText.trim() ||
              routingBusy
            }
            onClick={
              handleImport
            }
          >
            Crea bozza giornate
          </button>

          {days.length > 0 &&
          onShowOverview && (
            <button
              type="button"
              className="days-overview-button"
              disabled={routingBusy}
              onClick={
                onShowOverview
              }
            >
              Mostra viaggio completo
            </button>
          )}

          {days.length > 0 && (
            <button
              type="button"
              className="days-clear-button"
              disabled={routingBusy}
              onClick={
                handleClear
              }
            >
              Svuota giornate
            </button>
          )}
        </div>

        {routingProgress && (
          <div className="days-routing-progress">
            {routingProgress}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="days-warnings">
            <strong>
              Controlla:
            </strong>

            {warnings.map(
              (
                warning,
                index,
              ) => (
                <div
                  key={`${warning}-${index}`}
                >
                  {warning}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {days.length === 0 ? (
        <div className="days-empty-card">
          <strong>
            Nessuna giornata ancora creata
          </strong>

          <p>
            Incolla il programma del viaggio qui sopra. MotoRoute crea la struttura delle giornate; cliccando poi una giornata ne calcola e mostra il percorso sulla mappa.
          </p>
        </div>
      ) : (
        <div className="days-list">
          {days.map(
            (day) => {
              const summary =
                daySummary(day)

              const stats =
                routeStats[day.id]

              const selected =
                selectedDayId === day.id

              return (
                <button
                  key={day.id}
                  type="button"
                  className={
                    selected
                      ? 'trip-day-card trip-day-card--selected'
                      : 'trip-day-card'
                  }
                  disabled={
                    routingBusy ||
                    !onSelectDay
                  }
                  onClick={() =>
                    onSelectDay?.(day)
                  }
                >
                  <div className="trip-day-header">
                    <strong>
                      Giorno {day.dayNumber}
                    </strong>

                    <div className="trip-day-header-right">
                      {stats && (
                        <span className="trip-day-route-stats">
                          {formatDistance(
                            stats.distanceMeters,
                          )}
                          {' · '}
                          {formatDuration(
                            stats.durationSeconds,
                          )}
                        </span>
                      )}

                      <span>
                        {day.dateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="trip-day-main-route">
                    <strong>
                      {summary.start}
                    </strong>

                    <span>
                      →
                    </span>

                    <strong>
                      {summary.destination}
                    </strong>
                  </div>

                  {summary.via.length > 0 && (
                    <div className="trip-day-detail">
                      <span className="trip-day-label">
                        Passaggi
                      </span>

                      <span>
                        {summary.via.join(
                          ' · ',
                        )}
                      </span>
                    </div>
                  )}

                  {summary.ferries.map(
                    (
                      ferry,
                      index,
                    ) => (
                      <div
                        key={`${ferry.from}-${ferry.to}-${index}`}
                        className="trip-day-ferry"
                      >
                        <span>
                          TRAGHETTO
                        </span>

                        <strong>
                          {ferry.from} → {ferry.to}
                        </strong>
                      </div>
                    ),
                  )}

                  {day.notes.length > 0 && (
                    <div className="trip-day-notes">
                      {day.notes.map(
                        (
                          note,
                          index,
                        ) => (
                          <div
                            key={`${note}-${index}`}
                          >
                            Nota: {note}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </button>
              )
            },
          )}
        </div>
      )}

      <div className="hotel-later-card">
        <strong>
          Hotel
        </strong>

        <span>
          La gestione pernottamenti resta separata e verrà collegata alle giornate in una fase successiva.
        </span>
      </div>
    </section>
  )
}
