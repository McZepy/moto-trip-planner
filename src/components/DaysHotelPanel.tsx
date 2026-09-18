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

  routingProgress?:
    string | null

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
    return ''
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
  routingProgress,
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

  const [
    openDayId,
    setOpenDayId,
  ] =
    useState<
      string | null
    >(null)

  const nights =
    useMemo(
      () =>
        days.filter(
          (
            day,
          ) =>
            Boolean(
              day.overnight,
            ),
        ),
      [
        days,
      ],
    )

  const hotelTotal =
    useMemo(
      () =>
        nights.reduce(
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
        nights,
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
    nights.length ===
    0
  ) {
    return (
      <section className="days-panel">
        <div className="days-empty-card">
          <strong>
            Nessun pernottamento
          </strong>

          <p>
            Le notti compariranno qui dopo la generazione delle giornate in Itinerario & Tappe.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="days-panel">
      <div className="days-summary-line">
        <div>
          <strong>
            {nights.length} {nights.length === 1 ? 'pernottamento' : 'pernottamenti'}
          </strong>

          <span>
            riepilogo · ricerca hotel · costi
          </span>
        </div>

        {hotelTotal >
          0 && (
          <strong>
            € {hotelTotal.toFixed(2)}
          </strong>
        )}
      </div>

      {routingProgress && (
        <div className="days-routing-progress">
          {routingProgress}
        </div>
      )}

      <div className="days-strip-list">
        {nights.map(
          (
            day,
          ) => {
            const overnight =
              day.overnight!

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

            const display =
              hotelDisplay(
                day,
              )

            const platform =
              platforms[
                day.id
              ] ??
              'booking'

            const open =
              openDayId ===
              day.id

            return (
              <div
                key={
                  day.id
                }
                className={
                  selectedDayId ===
                    day.id
                    ? 'days-strip-wrap selected'
                    : 'days-strip-wrap'
                }
              >
                <button
                  type="button"
                  className="days-strip"
                  onClick={() =>
                    setOpenDayId(
                      open
                        ? null
                        : day.id,
                    )
                  }
                >
                  <span className="days-strip-badge">
                    N{day.dayNumber}
                  </span>

                  <span className="days-strip-main">
                    <strong>
                      Notte {day.dayNumber}: {display || overnight.name || 'Hotel non definito'}
                    </strong>

                    <small>
                      {overnight.checkIn}
                      {' · '}
                      {from?.name ?? '—'} → {to?.name ?? overnight.name}
                      {' · '}
                      {stats
                        ? `${formatDistance(stats.distanceMeters)} · ~${formatDuration(stats.durationSeconds)}`
                        : formatDistance(
                            day.plannedDistanceMeters ??
                              0,
                          )}
                    </small>
                  </span>

                  <span className="days-strip-menu">
                    {open
                      ? '⌃'
                      : '⋮'}
                  </span>
                </button>

                {open && (
                  <div className="days-strip-panel">
                    <div className="days-strip-detail">
                      <span>
                        Zona pernottamento
                      </span>

                      <strong>
                        {overnight.name}
                      </strong>

                      <small>
                        {overnight.label}
                      </small>
                    </div>

                    <div className="days-strip-detail">
                      <span>
                        Hotel
                      </span>

                      <strong>
                        {display ||
                          'Non ancora definito'}
                      </strong>

                      <small>
                        L’indirizzo si modifica esclusivamente in Itinerario & Tappe.
                      </small>
                    </div>

                    <div className="days-strip-hotel-search">
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
                        Cerca hotel
                      </button>
                    </div>

                    <label className="days-strip-price">
                      <span>
                        Prezzo pernottamento
                      </span>

                      <div>
                        <b>
                          €
                        </b>

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
                    </label>
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
