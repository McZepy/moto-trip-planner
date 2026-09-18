import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  autocompletePlaces,
  reverseLookupLocalityPoint,
  type SmartGeocodingResult,
} from '../providers/autocompleteProvider'

import {
  rankAutocompleteSuggestions,
} from '../providers/autocompleteRanking'

import type {
  GeocodingResult,
} from '../providers/geocodingProvider'

import type {
  TripRoutePlan,
} from '../providers/tripRoutePlanner'

import {
  cumulativeTargetsKm,
  roadDistanceMeters,
  routeBreakCandidates,
  type RouteBreakCandidate,
} from '../itinerary/routeDaySplitter'

import {
  HOTEL_PLATFORM_LABELS,
  hotelSearchUrl,
  type HotelPlatform,
} from '../itinerary/hotelSearchLinks'

import type {
  TripSettings,
} from '../types/trip'

import type {
  TripDay,
} from '../types/tripDay'

import './DaysHotelPanel.css'

type DaysHotelPanelProps = {
  days: TripDay[]

  /* Compatibilità temporanea con il contenitore App durante
   * la migrazione V0.7: non vengono più usati per generare
   * automaticamente il percorso da testo.
   */
  selectedDayId?: string | null
  routeStats?: Record<string, unknown>
  routingBusy?: boolean
  routingProgress?: string | null
  onSelectDay?: (day: TripDay) => void
  onShowOverview?: () => void

  routePlan:
    TripRoutePlan | null
  startPlace:
    GeocodingResult | null
  destinationPlace:
    GeocodingResult | null
  settings:
    TripSettings
  onChange:
    (days: TripDay[]) => void
  onDatesChange?:
    (
      departureDate: string,
      returnDate: string,
    ) => void
  onOvernightPlaceChange?:
    (
      dayId: string,
      place: GeocodingResult,
    ) => void
  onStatus?:
    (message: string) => void
}

type CandidateGroup = {
  targetKm: number
  candidates:
    RouteBreakCandidate[]
}

function formatDistance(
  meters: number,
) {
  return `${(
    meters /
    1000
  ).toFixed(0)} km`
}

function formatDuration(
  seconds: number,
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

  if (
    hours === 0
  ) {
    return `${minutes} min`
  }

  return (
    `${hours} h ` +
    `${minutes} min`
  )
}

function parseDate(
  value: string,
) {
  if (!value) {
    return null
  }

  const date =
    new Date(
      value +
        'T12:00:00',
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date
}

function addDays(
  value: string,
  days: number,
) {
  const date =
    parseDate(
      value,
    )

  if (!date) {
    return ''
  }

  date.setDate(
    date.getDate() +
      days,
  )

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    )

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    )

  return (
    `${year}-${month}-${day}`
  )
}

function displayDate(
  value: string,
) {
  const date =
    parseDate(
      value,
    )

  if (!date) {
    return 'Data da impostare'
  }

  return new Intl.DateTimeFormat(
    'it-IT',
    {
      day:
        '2-digit',
      month:
        '2-digit',
      year:
        'numeric',
    },
  ).format(
    date,
  )
}

function availableTripDays(
  settings:
    TripSettings,
) {
  const start =
    parseDate(
      settings.departureDate,
    )

  const end =
    parseDate(
      settings.returnDate,
    )

  if (
    !start ||
    !end
  ) {
    return null
  }

  const difference =
    Math.round(
      (
        end.getTime() -
        start.getTime()
      ) /
      86_400_000,
    )

  return difference >=
    0
    ? difference +
        1
    : null
}

function routeFerrySummary(
  plan:
    TripRoutePlan | null,
) {
  if (!plan) {
    return {
      distanceMeters:
        0,
      durationSeconds:
        0,
    }
  }

  return plan.sections.reduce(
    (
      total,
      section,
    ) => {
      if (
        section.type ===
        'ferry'
      ) {
        return {
          distanceMeters:
            total
              .distanceMeters +
            section
              .distanceMeters,

          durationSeconds:
            total
              .durationSeconds +
            section
              .durationSeconds,
        }
      }

      const embedded =
        section
          .embeddedFerries ??
        []

      return {
        distanceMeters:
          total
            .distanceMeters +
          embedded.reduce(
            (
              subtotal,
              ferry,
            ) =>
              subtotal +
              ferry
                .distanceMeters,
            0,
          ),

        durationSeconds:
          total
            .durationSeconds +
          embedded.reduce(
            (
              subtotal,
              ferry,
            ) =>
              subtotal +
              ferry
                .durationSeconds,
            0,
          ),
      }
    },
    {
      distanceMeters:
        0,
      durationSeconds:
        0,
    },
  )
}

function createDayId(
  index: number,
  date: string,
) {
  return (
    'split-day-' +
    (
      index +
      1
    ) +
    '-' +
    date
  )
}

function selectedPlace(
  candidate:
    RouteBreakCandidate,
) {
  const place =
    candidate.place

  if (place) {
    return place
  }

  return {
    id:
      `route-break:${candidate.routeKm.toFixed(1)}`,

    name:
      `Sosta km ${candidate.routeKm.toFixed(0)}`,

    label:
      `Punto sul percorso al km ${candidate.routeKm.toFixed(0)}`,

    lat:
      candidate
        .point
        .lat,

    lng:
      candidate
        .point
        .lng,
  } satisfies GeocodingResult
}

export function DaysHotelPanel({
  days,
  routePlan,
  startPlace,
  destinationPlace,
  settings,
  onChange,
  onDatesChange,
  onOvernightPlaceChange,
  onStatus,
}: DaysHotelPanelProps) {
  const roadKm =
    routePlan
      ? roadDistanceMeters(
          routePlan,
        ) /
        1000
      : 0

  const ferry =
    useMemo(
      () =>
        routeFerrySummary(
          routePlan,
        ),
      [
        routePlan,
      ],
    )

  const [
    dayCount,
    setDayCount,
  ] =
    useState(
      3,
    )

  const [
    targetKm,
    setTargetKm,
  ] =
    useState<number[]>(
      [],
    )

  const [
    toleranceKm,
    setToleranceKm,
  ] =
    useState<
      20 | 50
    >(
      50,
    )

  const [
    candidateGroups,
    setCandidateGroups,
  ] =
    useState<
      CandidateGroup[]
    >([])

  const [
    selectedCandidateIndexes,
    setSelectedCandidateIndexes,
  ] =
    useState<
      number[]
    >([])

  const [
    finding,
    setFinding,
  ] =
    useState(false)

  const [
    actionMessage,
    setActionMessage,
  ] =
    useState<string | null>(
      null,
    )

  const [
    hotelPlatforms,
    setHotelPlatforms,
  ] =
    useState<
      Record<
        string,
        HotelPlatform
      >
    >({})

  const [
    hotelQueries,
    setHotelQueries,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({})

  const [
    hotelResults,
    setHotelResults,
  ] =
    useState<
      Record<
        string,
        SmartGeocodingResult[]
      >
    >({})

  const [
    hotelSearchingDayId,
    setHotelSearchingDayId,
  ] =
    useState<
      string | null
    >(null)

  useEffect(() => {
    if (
      !routePlan ||
      roadKm <=
        0
    ) {
      setTargetKm([])
      setCandidateGroups([])
      setSelectedCandidateIndexes([])
      return
    }

    const safeCount =
      Math.max(
        1,
        dayCount,
      )

    const equal =
      Math.round(
        roadKm /
        safeCount,
      )

    setTargetKm(
      Array.from(
        {
          length:
            Math.max(
              0,
              safeCount -
                1,
            ),
        },
        () =>
          equal,
      ),
    )

    setCandidateGroups([])
    setSelectedCandidateIndexes([])
  }, [
    routePlan,
    roadKm,
    dayCount,
  ])

  const firstDayTargets =
    targetKm.map(
      (
        value,
      ) =>
        Math.max(
          1,
          Number(
            value,
          ) ||
            1,
        ),
    )

  const usedKm =
    firstDayTargets.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    )

  const lastDayKm =
    Math.max(
      0,
      roadKm -
      usedKm,
    )

  const splitTargets = [
    ...firstDayTargets,
    lastDayKm,
  ]

  const availableDays =
    availableTripDays(
      settings,
    )

  const handleFindBreaks =
    async () => {
      if (
        !routePlan ||
        !startPlace ||
        !destinationPlace
      ) {
        const message =
          'Traccia prima il percorso completo in Itinerario & Tappe.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
        return
      }

      if (
        splitTargets.some(
          (
            value,
          ) =>
            value <=
            0,
        )
      ) {
        const message =
          'Le distanze impostate superano la lunghezza del percorso.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
        return
      }

      setActionMessage(
        null,
      )

      setFinding(
        true,
      )

      try {
        const cumulative =
          cumulativeTargetsKm(
            splitTargets,
          )

        const groups:
          CandidateGroup[] = []

        const defaults:
          number[] = []

        for (
          let index =
            0;
          index <
            cumulative.length;
          index +=
            1
        ) {
          const target =
            cumulative[
              index
            ]

          const raw =
            routeBreakCandidates(
              routePlan,
              target,
              toleranceKm,
            )

          const candidates:
            RouteBreakCandidate[] = []

          for (
            const candidate
            of raw
          ) {
            try {
              const place =
                await reverseLookupLocalityPoint(
                  candidate.point,
                )

              candidates.push({
                ...candidate,
                place,
              })
            } catch {
              candidates.push(
                candidate,
              )
            }
          }

          const nearestIndex =
            candidates.reduce(
              (
                best,
                candidate,
                candidateIndex,
              ) => {
                if (
                  candidates.length ===
                  0
                ) {
                  return 0
                }

                const bestDistance =
                  Math.abs(
                    candidates[
                      best
                    ].routeKm -
                    target,
                  )

                const currentDistance =
                  Math.abs(
                    candidate.routeKm -
                    target,
                  )

                return currentDistance <
                  bestDistance
                  ? candidateIndex
                  : best
              },
              0,
            )

          groups.push({
            targetKm:
              target,
            candidates,
          })

          defaults.push(
            nearestIndex,
          )
        }

        setCandidateGroups(
          groups,
        )

        setSelectedCandidateIndexes(
          defaults,
        )

        const message =
          `${groups.length} punti di fine giornata individuati lungo il percorso.`

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
      } catch (error) {
        console.error(
          error,
        )

        const message =
          error instanceof Error
            ? error.message
            : 'Errore durante la ricerca dei punti di fine giornata.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
      } finally {
        setFinding(
          false,
        )
      }
    }

  const handleConfirmDays =
    () => {
      if (
        !startPlace ||
        !destinationPlace ||
        candidateGroups.length !==
          Math.max(
            0,
            dayCount -
              1,
          )
      ) {
        const message =
          'Trova e seleziona prima i punti di fine giornata.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
        return
      }

      if (
        !settings.departureDate
      ) {
        const message =
          'Imposta prima la data di partenza qui sopra.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
        return
      }

      const boundaries =
        candidateGroups.map(
          (
            group,
            index,
          ) =>
            group.candidates[
              selectedCandidateIndexes[
                index
              ] ??
                0
            ],
        )

      if (
        boundaries.some(
          (
            boundary,
          ) =>
            !boundary,
        )
      ) {
        const message =
          'Seleziona un punto valido per ogni pernottamento.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
        return
      }

      const places:
        GeocodingResult[] = [
          startPlace,

          ...boundaries.map(
            (
              boundary,
            ) =>
              selectedPlace(
                boundary as RouteBreakCandidate,
              ),
          ),

          destinationPlace,
        ]

      const cumulativeKm = [
        0,

        ...boundaries.map(
          (
            boundary,
          ) =>
            (
              boundary as RouteBreakCandidate
            ).routeKm,
        ),

        roadKm,
      ]

      const nextDays:
        TripDay[] = []

      for (
        let index =
          0;
        index <
          places.length -
            1;
        index +=
          1
      ) {
        const date =
          addDays(
            settings.departureDate,
            index,
          )

        const checkOut =
          addDays(
            settings.departureDate,
            index +
              1,
          )

        const from =
          places[
            index
          ]

        const to =
          places[
            index +
              1
          ]

        const plannedDistanceMeters =
          Math.max(
            0,
            (
              cumulativeKm[
                index +
                1
              ] -
              cumulativeKm[
                index
              ]
            ) *
              1000,
          )

        const hasOvernight =
          index <
          places.length -
            2

        nextDays.push({
          id:
            createDayId(
              index,
              date,
            ),

          dayNumber:
            index +
            1,

          dateLabel:
            displayDate(
              date,
            ),

          steps: [
            {
              kind:
                'place',
              name:
                from.name,
            },
            {
              kind:
                'place',
              name:
                to.name,
            },
          ],

          notes:
            [],

          plannedDistanceMeters,

          overnight:
            hasOvernight
              ? {
                  name:
                    to.name,

                  label:
                    to.label,

                  lat:
                    to.lat,

                  lng:
                    to.lng,

                  checkIn:
                    date,

                  checkOut,
                }
              : undefined,

          routingOverride: {
            startPlace: {
              ...from,
            },

            destinationPlace: {
              ...to,
            },

            waypoints:
              [],
          },
        })
      }

      onChange(
        nextDays,
      )

      const message =
        `Percorso diviso in ${nextDays.length} giornate con date automatiche.`

      setActionMessage(
        message,
      )
      onStatus?.(
        message,
      )
    }

  const searchHotelAddress =
    async (
      day:
        TripDay,
    ) => {
      const query =
        (
          hotelQueries[
            day.id
          ] ??
          ''
        ).trim()

      if (
        query.length <
        3
      ) {
        setActionMessage(
          'Scrivi almeno 3 caratteri dell’indirizzo o del nome hotel.',
        )
        return
      }

      setHotelSearchingDayId(
        day.id,
      )

      try {
        const focus =
          day.overnight
            ? {
                lat:
                  day.overnight
                    .lat,

                lng:
                  day.overnight
                    .lng,
              }
            : undefined

        const results =
          await autocompletePlaces(
            query,
            undefined,
            {
              focus,
            },
          )

        setHotelResults(
          (
            current,
          ) => ({
            ...current,
            [day.id]:
              rankAutocompleteSuggestions(
                query,
                results,
                focus,
              ).slice(
                0,
                6,
              ),
          }),
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Ricerca indirizzo hotel non disponibile.'

        setActionMessage(
          message,
        )
        onStatus?.(
          message,
        )
      } finally {
        setHotelSearchingDayId(
          null,
        )
      }
    }

  const chooseHotelAddress =
    (
      day:
        TripDay,
      place:
        GeocodingResult,
    ) => {
      setHotelQueries(
        (
          current,
        ) => ({
          ...current,
          [day.id]:
            place.label ||
            place.name,
        }),
      )

      setHotelResults(
        (
          current,
        ) => ({
          ...current,
          [day.id]:
            [],
        }),
      )

      onOvernightPlaceChange?.(
        day.id,
        place,
      )

      const message =
        `Fine giornata ${day.dayNumber} spostata su ${place.name}.`

      setActionMessage(
        message,
      )

      onStatus?.(
        message,
      )
    }

  const openHotelSearch =
    (
      day:
        TripDay,
    ) => {
      if (!day.overnight) {
        return
      }

      const platform =
        hotelPlatforms[
          day.id
        ] ??
        'booking'

      const query =
        day.overnight
          .name ||
        day.overnight
          .label

      const url =
        hotelSearchUrl(
          platform,
          query,
          day.overnight
            .checkIn,
          day.overnight
            .checkOut,
        )

      window.open(
        url,
        '_blank',
        'noopener,noreferrer',
      )
    }

  if (
    !routePlan ||
    !startPlace ||
    !destinationPlace
  ) {
    return (
      <section className="days-panel">
        <div className="days-empty-card">
          <strong>
            Prima traccia il percorso
          </strong>

          <p>
            Imposta partenza, arrivo e gli eventuali punti strada in Itinerario & Tappe. Quando il percorso è pronto potrai dividerlo in giornate.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="days-panel">
      <div className="days-import-card">
        <div className="days-import-heading">
          <div>
            <strong>
              Dividi il percorso in giornate
            </strong>

            <p>
              Il percorso resta quello tracciato manualmente. MotoRoute cerca solo i punti di fine giornata lungo la traccia.
            </p>
          </div>

          <span className="days-count-badge">
            {roadKm.toFixed(
              0,
            )} km strada
          </span>
        </div>

        <div className="days-route-summary">
          <span>
            <strong>
              {startPlace.name}
            </strong>
            {' → '}
            <strong>
              {destinationPlace.name}
            </strong>
          </span>

          <span>
            {formatDistance(
              routePlan
                .distanceMeters,
            )}
            {' · '}
            {formatDuration(
              routePlan
                .durationSeconds,
            )}
          </span>

          {ferry.durationSeconds >
            0 && (
            <span>
              Traghetto:
              {' '}
              {formatDistance(
                ferry.distanceMeters,
              )}
              {' · '}
              {formatDuration(
                ferry.durationSeconds,
              )}
            </span>
          )}
        </div>

        <div className="days-date-grid">
          <label>
            <span>
              Data partenza
            </span>

            <input
              type="date"
              value={
                settings.departureDate
              }
              onChange={(
                event,
              ) =>
                onDatesChange?.(
                  event
                    .target
                    .value,
                  settings.returnDate,
                )
              }
            />
          </label>

          <label>
            <span>
              Data rientro / fine viaggio
            </span>

            <input
              type="date"
              min={
                settings.departureDate ||
                undefined
              }
              value={
                settings.returnDate
              }
              onChange={(
                event,
              ) =>
                onDatesChange?.(
                  settings.departureDate,
                  event
                    .target
                    .value,
                )
              }
            />
          </label>
        </div>

        <div className="days-split-grid">
          <label>
            <span>
              Numero giornate
            </span>

            <input
              type="number"
              min="1"
              max="30"
              value={
                dayCount
              }
              onChange={(
                event,
              ) =>
                setDayCount(
                  Math.max(
                    1,
                    Math.min(
                      30,
                      Number(
                        event
                          .target
                          .value,
                      ) ||
                        1,
                    ),
                  ),
                )
              }
            />
          </label>

          <label>
            <span>
              Tolleranza
            </span>

            <select
              value={
                toleranceKm
              }
              onChange={(
                event,
              ) =>
                setToleranceKm(
                  Number(
                    event
                      .target
                      .value,
                  ) ===
                    20
                    ? 20
                    : 50,
                )
              }
            >
              <option value="20">
                ± 20 km
              </option>

              <option value="50">
                ± 50 km
              </option>
            </select>
          </label>
        </div>

        {dayCount >
          1 && (
          <div className="days-km-plan">
            {targetKm.map(
              (
                value,
                index,
              ) => (
                <label
                  key={
                    index
                  }
                >
                  <span>
                    Giorno {index + 1}
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="10"
                    value={
                      value
                    }
                    onChange={(
                      event,
                    ) =>
                      setTargetKm(
                        (
                          current,
                        ) =>
                          current.map(
                            (
                              item,
                              itemIndex,
                            ) =>
                              itemIndex ===
                              index
                                ? Math.max(
                                    1,
                                    Number(
                                      event
                                        .target
                                        .value,
                                    ) ||
                                      1,
                                  )
                                : item,
                          ),
                      )
                    }
                  />

                  <small>
                    km desiderati
                  </small>
                </label>
              ),
            )}

            <div className="days-last-remainder">
              <span>
                Giorno {dayCount}
              </span>

              <strong>
                {lastDayKm.toFixed(
                  0,
                )} km
              </strong>

              <small>
                restante
              </small>
            </div>
          </div>
        )}

        <div className="days-availability-note">
          {availableDays
            ? dayCount <=
              availableDays
              ? `${availableDays} giorni disponibili dal ${displayDate(settings.departureDate)} al ${displayDate(settings.returnDate)} · ${availableDays - dayCount} giorni non assegnati.`
              : `Attenzione: hai ${availableDays} giorni disponibili ma stai creando ${dayCount} giornate.`
            : 'Imposta data di partenza e rientro nelle Impostazioni viaggio per assegnare automaticamente le date.'}
        </div>

        <div className="days-import-actions">
          <button
            type="button"
            className="days-import-primary"
            disabled={
              finding ||
              dayCount <
                2
            }
            onClick={
              handleFindBreaks
            }
          >
            {finding
              ? 'Cerco punti...'
              : 'Trova punti di fine giornata'}
          </button>

          {candidateGroups.length ===
            Math.max(
              0,
              dayCount -
                1,
            ) &&
          dayCount >
            1 && (
            <button
              type="button"
              className="days-overview-button"
              onClick={
                handleConfirmDays
              }
            >
              Conferma divisione
            </button>
          )}
        </div>

        {actionMessage && (
          <div className="days-action-message">
            {actionMessage}
          </div>
        )}
      </div>

      {candidateGroups.length >
        0 && (
        <div className="days-break-groups">
          {candidateGroups.map(
            (
              group,
              groupIndex,
            ) => (
              <div
                className="days-break-group"
                key={
                  groupIndex
                }
              >
                <div className="days-break-heading">
                  <strong>
                    Fine Giorno {groupIndex + 1}
                  </strong>

                  <span>
                    obiettivo km {group.targetKm.toFixed(0)}
                  </span>
                </div>

                {group.candidates.map(
                  (
                    candidate,
                    candidateIndex,
                  ) => {
                    const place =
                      selectedPlace(
                        candidate,
                      )

                    const active =
                      (
                        selectedCandidateIndexes[
                          groupIndex
                        ] ??
                        0
                      ) ===
                      candidateIndex

                    return (
                      <button
                        key={
                          candidateIndex
                        }
                        type="button"
                        className={
                          active
                            ? 'days-break-candidate active'
                            : 'days-break-candidate'
                        }
                        onClick={() =>
                          setSelectedCandidateIndexes(
                            (
                              current,
                            ) => {
                              const next = [
                                ...current,
                              ]

                              next[
                                groupIndex
                              ] =
                                candidateIndex

                              return next
                            },
                          )
                        }
                      >
                        <strong>
                          {place.name}
                        </strong>

                        <span>
                          km {candidate.routeKm.toFixed(0)}
                          {' · '}
                          {candidate.routeKm >=
                          group.targetKm
                            ? '+'
                            : ''}
                          {(candidate.routeKm - group.targetKm).toFixed(0)} km
                        </span>

                        <small>
                          {place.label}
                        </small>
                      </button>
                    )
                  },
                )}
              </div>
            ),
          )}
        </div>
      )}

      {days.length >
        0 && (
        <div className="days-list">
          {days.map(
            (
              day,
              index,
            ) => {
              const from =
                day.steps.find(
                  (
                    step,
                  ) =>
                    step.kind ===
                    'place',
                )

              const to =
                [...day.steps]
                  .reverse()
                  .find(
                    (
                      step,
                    ) =>
                      step.kind ===
                      'place',
                  )

              const platform =
                hotelPlatforms[
                  day.id
                ] ??
                'booking'

              return (
                <div
                  className="trip-day-card"
                  key={
                    day.id
                  }
                >
                  <div className="trip-day-header">
                    <strong>
                      Giorno {index + 1}
                    </strong>

                    <div className="trip-day-header-right">
                      {day
                        .plannedDistanceMeters !==
                        undefined && (
                        <span className="trip-day-route-stats">
                          {formatDistance(
                            day
                              .plannedDistanceMeters,
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
                      {from?.kind ===
                      'place'
                        ? from.name
                        : '—'}
                    </strong>

                    <span>
                      →
                    </span>

                    <strong>
                      {to?.kind ===
                      'place'
                        ? to.name
                        : '—'}
                    </strong>
                  </div>

                  {day.overnight && (
                    <div className="day-hotel-search">
                      <div>
                        <span className="trip-day-label">
                          Pernottamento
                        </span>

                        <strong>
                          {day.overnight.name}
                        </strong>

                        <small>
                          check-in {displayDate(day.overnight.checkIn)}
                          {' · '}
                          check-out {displayDate(day.overnight.checkOut)}
                        </small>
                      </div>

                      <div className="day-hotel-point-editor">
                        <label>
                          <span>
                            Hotel scelto / indirizzo esatto
                          </span>

                          <div className="day-hotel-point-search">
                            <input
                              type="text"
                              value={
                                hotelQueries[
                                  day.id
                                ] ??
                                ''
                              }
                              placeholder="Es. nome hotel o indirizzo"
                              onChange={(
                                event,
                              ) =>
                                setHotelQueries(
                                  (
                                    current,
                                  ) => ({
                                    ...current,
                                    [day.id]:
                                      event
                                        .target
                                        .value,
                                  }),
                                )
                              }
                              onKeyDown={(
                                event,
                              ) => {
                                if (
                                  event.key ===
                                  'Enter'
                                ) {
                                  event.preventDefault()

                                  void searchHotelAddress(
                                    day,
                                  )
                                }
                              }}
                            />

                            <button
                              type="button"
                              disabled={
                                hotelSearchingDayId ===
                                day.id
                              }
                              onClick={() =>
                                void searchHotelAddress(
                                  day,
                                )
                              }
                            >
                              {hotelSearchingDayId ===
                              day.id
                                ? 'Cerco…'
                                : 'Trova'}
                            </button>
                          </div>
                        </label>

                        {(hotelResults[
                          day.id
                        ]?.length ??
                          0) >
                          0 && (
                          <div className="day-hotel-point-results">
                            {hotelResults[
                              day.id
                            ].map(
                              (
                                result,
                              ) => (
                                <button
                                  key={
                                    result.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    chooseHotelAddress(
                                      day,
                                      result,
                                    )
                                  }
                                >
                                  <strong>
                                    {result.name}
                                  </strong>

                                  <small>
                                    {result.label}
                                  </small>
                                </button>
                              ),
                            )}
                          </div>
                        )}

                        <small className="day-hotel-point-hint">
                          Puoi anche trascinare il marker della notte direttamente sulla mappa.
                        </small>
                      </div>

                      <div className="day-hotel-actions">
                        <select
                          value={
                            platform
                          }
                          onChange={(
                            event,
                          ) =>
                            setHotelPlatforms(
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
                    </div>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}

      <div className="hotel-later-card">
        <strong>
          Prossimo passo
        </strong>

        <span>
          Dopo la divisione in giornate collegheremo carburante e pause relax direttamente ai chilometri di ciascuna tappa.
        </span>
      </div>
    </section>
  )
}
