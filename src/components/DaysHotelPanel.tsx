import {
  useState,
} from 'react'

import {
  getTripDayFerryLegs,
  getTripDayPlaces,
  parseItineraryText,
} from '../itinerary/itineraryTextParser'

import type {
  TripDay,
} from '../types/tripDay'

import './DaysHotelPanel.css'

type DaysHotelPanelProps = {
  days: TripDay[]
  onChange:
    (days: TripDay[]) => void
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

export function DaysHotelPanel({
  days,
  onChange,
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
              !sourceText.trim()
            }
            onClick={
              handleImport
            }
          >
            Crea bozza giornate
          </button>

          {days.length > 0 && (
            <button
              type="button"
              className="days-clear-button"
              onClick={
                handleClear
              }
            >
              Svuota giornate
            </button>
          )}
        </div>

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
            Incolla il programma del viaggio qui sopra. In questa fase MotoRoute crea la struttura delle giornate senza ancora geocodificare o calcolare i singoli percorsi.
          </p>
        </div>
      ) : (
        <div className="days-list">
          {days.map(
            (day) => {
              const summary =
                daySummary(day)

              return (
                <article
                  key={day.id}
                  className="trip-day-card"
                >
                  <div className="trip-day-header">
                    <strong>
                      Giorno {day.dayNumber}
                    </strong>

                    <span>
                      {day.dateLabel}
                    </span>
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
                </article>
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
