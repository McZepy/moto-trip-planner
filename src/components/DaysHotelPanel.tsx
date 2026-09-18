import {
  useMemo,
  useState,
} from 'react'

import {
  HOTEL_PLATFORM_LABELS,
  hotelSearchUrl,
  type HotelPlatform,
} from '../itinerary/hotelSearchLinks'

import type {
  TripDay,
} from '../types/tripDay'

import './DaysHotelPanel.css'

type DaysHotelPanelProps = {
  days:
    TripDay[]

  selectedDayId?:
    string | null

  routeStats?: Record<
    string,
    {
      distanceMeters:
        number
      durationSeconds:
        number
      usesFerry:
        boolean
    }
  >

  routingBusy?:
    boolean

  routingProgress?:
    string | null

  onSelectDay?:
    (
      day:
        TripDay,
    ) => void

  onShowOverview?:
    () => void

  onHotelPriceChange?:
    (
      dayId:
        string,
      priceEur:
        number | undefined,
    ) => void

  onStatus?:
    (
      message:
        string,
    ) => void
}

function formatDistance(
  meters:
    number,
) {
  return `${(
    meters /
    1000
  ).toFixed(0)} km`
}

function formatDuration(
  seconds:
    number,
) {
  const totalMinutes =
    Math.round(
      seconds /
      60,
    )

  const hours =
    Math.floor(
      totalMinutes /
      60,
    )

  const minutes =
    totalMinutes %
    60

  return hours >
    0
    ? `${hours} h ${minutes} min`
    : `${minutes} min`
}

function hotelDisplay(
  day:
    TripDay,
) {
  const overnight =
    day.overnight

  if (!overnight) {
    return null
  }

  return (
    overnight.hotelDisplay
      ?.trim() ||
    ''
  )
}

export function DaysHotelPanel({
  days,
  selectedDayId,
  routeStats,
  routingBusy,
  routingProgress,
  onSelectDay,
  onShowOverview,
  onHotelPriceChange,
  onStatus,
}: DaysHotelPanelProps) {
  const [
    platforms,
    setPlatforms,
  ] =
    useState<
      Record<
        string,
        HotelPlatform
      >
    >({})

  const hotelTotal =
    useMemo(
      () =>
        days.reduce(
          (
            total,
            day,
          ) =>
            total +
            (
              day
                .overnight
                ?.priceEur ??
              0
            ),
          0,
        ),
      [
        days,
      ],
    )

  const openHotelSearch =
    (
      day:
        TripDay,
    ) => {
      const overnight =
        day.overnight

      if (!overnight) {
        return
      }

      const platform =
        platforms[
          day.id
        ] ??
        'booking'

      const query =
        overnight.name ||
        overnight.label

      window.open(
        hotelSearchUrl(
          platform,
          query,
          overnight.checkIn,
          overnight.checkOut,
        ),
        '_blank',
        'noopener,noreferrer',
      )

      onStatus?.(
        `Aperta ricerca alloggio per ${overnight.name}.`,
      )
    }

  if (
    days.length ===
    0
  ) {
    return (
      <section className="days-panel">
        <div className="days-empty-card">
          <strong>
            Nessuna giornata generata
          </strong>

          <p>
            Traccia il percorso e genera le tappe giornaliere nella scheda Itinerario & Tappe.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="days-panel">
      <div className="days-summary-card">
        <div>
          <strong>
            Riepilogo pernottamenti
          </strong>

          <span>
            Gli indirizzi hotel si impostano esclusivamente in Itinerario & Tappe.
          </span>
        </div>

        {hotelTotal >
          0 && (
          <strong className="days-hotel-total">
            Hotel inseriti: € {hotelTotal.toFixed(2)}
          </strong>
        )}
      </div>

      <div className="days-view-actions">
        <button
          type="button"
          disabled={
            routingBusy
          }
          onClick={() =>
            onShowOverview?.()
          }
        >
          Mostra viaggio completo
        </button>

        {routingProgress && (
          <span>
            {routingProgress}
          </span>
        )}
      </div>

      <div className="days-list">
        {days.map(
          (
            day,
          ) => {
            const from =
              day.routingOverride
                ?.startPlace

            const to =
              day.routingOverride
                ?.destinationPlace

            const stats =
              routeStats?.[
                day.id
              ]

            const overnight =
              day.overnight

            const display =
              hotelDisplay(
                day,
              )

            const platform =
              platforms[
                day.id
              ] ??
              'booking'

            return (
              <div
                key={
                  day.id
                }
                className={
                  selectedDayId ===
                    day.id
                    ? 'trip-day-card selected'
                    : 'trip-day-card'
                }
              >
                <div className="trip-day-header">
                  <strong>
                    Giorno {day.dayNumber}
                  </strong>

                  <div className="trip-day-header-right">
                    {stats ? (
                      <span className="trip-day-route-stats">
                        {formatDistance(
                          stats.distanceMeters,
                        )}
                        {' · '}
                        {formatDuration(
                          stats.durationSeconds,
                        )}
                      </span>
                    ) : (
                      <span className="trip-day-route-stats">
                        {formatDistance(
                          day.plannedDistanceMeters ??
                            0,
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
                    {from?.name ?? '—'}
                  </strong>

                  <span>
                    →
                  </span>

                  <strong>
                    {to?.name ?? '—'}
                  </strong>
                </div>

                <button
                  type="button"
                  className="trip-day-open-button"
                  disabled={
                    routingBusy
                  }
                  onClick={() =>
                    onSelectDay?.(
                      day,
                    )
                  }
                >
                  Mostra / modifica Giorno {day.dayNumber}
                </button>

                {overnight && (
                  <div className="day-hotel-summary">
                    <div className="day-hotel-summary-main">
                      <span>
                        Notte {day.dayNumber}
                      </span>

                      <strong>
                        {display ||
                          'Hotel non definito'}
                      </strong>

                      <small>
                        zona: {overnight.name}
                        {' · '}
                        check-in {overnight.checkIn}
                        {' · '}
                        check-out {overnight.checkOut}
                      </small>
                    </div>

                    <div className="day-hotel-price">
                      <label>
                        Prezzo hotel
                      </label>

                      <div>
                        <span>
                          €
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={
                            overnight.priceEur ??
                            ''
                          }
                          onChange={(
                            event,
                          ) =>
                            onHotelPriceChange?.(
                              day.id,
                              event
                                .target
                                .value ===
                                ''
                                ? undefined
                                : Math.max(
                                    0,
                                    Number(
                                      event
                                        .target
                                        .value,
                                    ) ||
                                      0,
                                  ),
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="day-hotel-actions">
                      <select
                        value={
                          platform
                        }
                        onChange={(
                          event,
                        ) =>
                          setPlatforms(
                            (
                              current,
                            ) => ({
                              ...current,
                              [day.id]:
                                event
                                  .target
                                  .value as HotelPlatform,
                            }),
                          )
                        }
                      >
                        {(
                          Object.keys(
                            HOTEL_PLATFORM_LABELS,
                          ) as HotelPlatform[]
                        ).map(
                          (
                            item,
                          ) => (
                            <option
                              key={
                                item
                              }
                              value={
                                item
                              }
                            >
                              {
                                HOTEL_PLATFORM_LABELS[
                                  item
                                ]
                              }
                            </option>
                          ),
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          openHotelSearch(
                            day,
                          )
                        }
                      >
                        Cerca alloggio
                      </button>
                    </div>

                    <small className="day-hotel-summary-hint">
                      Dopo la prenotazione torna in Itinerario & Tappe, apri il giorno e inserisci il nome hotel o l'indirizzo come Arrivo.
                    </small>
                  </div>
                )}
              </div>
            )
          },
        )}
      </div>
    </section>
  )
}
