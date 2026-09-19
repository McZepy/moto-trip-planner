import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  autocompleteLocalities,
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
  roadKmAtPoint,
  routeBreakCandidates,
} from '../itinerary/routeDaySplitter'

import type {
  TripSettings,
} from '../types/trip'

import type {
  TripDay,
} from '../types/tripDay'

import type {
  Waypoint,
} from '../types/waypoint'

import { EditableNumberInput } from './EditableNumberInput'

import './ItineraryDayPlanner.css'

type ItineraryDayPlannerProps = {
  routePlan:
    TripRoutePlan | null

  startPlace:
    GeocodingResult | null

  destinationPlace:
    GeocodingResult | null

  masterWaypoints:
    Waypoint[]

  settings:
    TripSettings

  days:
    TripDay[]

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

  onChange:
    (
      days:
        TripDay[],
    ) => void

  onOpenDay:
    (
      day:
        TripDay,
    ) => void

  onSetOvernightDestination?:
    (
      day:
        TripDay,
      place:
        GeocodingResult,
    ) =>
      | void
      | Promise<void>

  onStatus?:
    (
      message:
        string,
    ) => void
}

function parseDate(
  value:
    string,
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
  value:
    string,
  days:
    number,
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
  value:
    string,
) {
  const date =
    parseDate(
      value,
    )

  if (!date) {
    return '—'
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

function distanceMeters(
  first: {
    lat: number
    lng: number
  },
  second: {
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
      first.lat,
    )

  const lat2 =
    toRad(
      second.lat,
    )

  const deltaLat =
    toRad(
      second.lat -
      first.lat,
    )

  const deltaLng =
    toRad(
      second.lng -
      first.lng,
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

function cloneWaypoint(
  waypoint:
    Waypoint,
): Waypoint {
  return {
    ...waypoint,

    boundingBox:
      waypoint.boundingBox
        ? {
            ...waypoint.boundingBox,
          }
        : undefined,
  }
}

function equalTargets(
  totalKm:
    number,
  count:
    number,
) {
  if (
    count <=
    0
  ) {
    return []
  }

  const equal =
    Math.max(
      1,
      totalKm /
        count,
    )

  return Array.from(
    {
      length:
        count,
    },
    () =>
      equal,
  )
}

function normalizedDayTargets(
  totalKm:
    number,
  values:
    number[],
  count:
    number,
) {
  if (
    count <=
    0
  ) {
    return []
  }

  const output =
    values
      .slice(
        0,
        count,
      )
      .map(
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

  while (
    output.length <
    count
  ) {
    output.push(
      Math.max(
        1,
        totalKm /
          count,
      ),
    )
  }

  const sum =
    output.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,
      0,
    )

  if (
    sum <=
    0
  ) {
    return equalTargets(
      totalKm,
      count,
    )
  }

  const scale =
    totalKm /
    sum

  return output.map(
    (
      value,
    ) =>
      value *
      scale,
  )
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

  if (
    hours <=
    0
  ) {
    return `${minutes} min`
  }

  return `${hours} h ${minutes} min`
}

function dayId(
  index:
    number,
  date:
    string,
) {
  return (
    'day-' +
    (
      index +
      1
    ) +
    '-' +
    (
      date ||
      'no-date'
    )
  )
}

export function ItineraryDayPlanner({
  routePlan,
  startPlace,
  destinationPlace,
  masterWaypoints,
  settings,
  days,
  routeStats,
  onChange,
  onOpenDay,
  onSetOvernightDestination,
  onStatus,
}: ItineraryDayPlannerProps) {
  const roadKm =
    useMemo(
      () =>
        routePlan
          ? roadDistanceMeters(
              routePlan,
            ) /
            1000
          : 0,
      [
        routePlan,
      ],
    )

  const plannedDays =
    Math.max(
      1,
      settings.plannedDays ??
        1,
    )

  const [
    dayTargets,
    setDayTargets,
  ] =
    useState<
      number[]
    >([])

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    )

  const [
    openDayId,
    setOpenDayId,
  ] =
    useState<
      string | null
    >(null)

  const [
    hotelEditDayId,
    setHotelEditDayId,
  ] =
    useState<
      string | null
    >(null)

  const [
    hotelQuery,
    setHotelQuery,
  ] =
    useState('')

  const [
    hotelResults,
    setHotelResults,
  ] =
    useState<
      SmartGeocodingResult[]
    >([])

  const [
    hotelLoading,
    setHotelLoading,
  ] =
    useState(false)

  const hotelAutocompleteControllerRef =
    useRef<
      AbortController | null
    >(null)

  const autoKeyRef =
    useRef<
      string | null
    >(null)

  useEffect(
    () => {
      if (
        roadKm <=
        0
      ) {
        setDayTargets(
          [],
        )

        return
      }

      if (
        days.length ===
        plannedDays &&
        days.every(
          (
            day,
          ) =>
            typeof day
              .plannedDistanceMeters ===
            'number',
        )
      ) {
        setDayTargets(
          days.map(
            (
              day,
            ) =>
              (
                day
                  .plannedDistanceMeters ??
                0
              ) /
              1000,
          ),
        )

        return
      }

      setDayTargets(
        equalTargets(
          roadKm,
          plannedDays,
        ),
      )
    },
    [
      roadKm,
      plannedDays,
      days,
    ],
  )

  const resolveBoundary =
    useCallback(
      async (
        targetKm:
          number,
      ) => {
        if (!routePlan) {
          return null
        }

        const raw =
          routeBreakCandidates(
            routePlan,
            targetKm,
            50,
          )

        const options:
          Array<{
            place:
              GeocodingResult
            routeKm:
              number
            score:
              number
          }> = []

        for (
          const candidate
          of raw
        ) {
          try {
            const locality =
              await reverseLookupLocalityPoint(
                candidate.point,
              )

            let place:
              GeocodingResult =
              locality

            try {
              const localities =
                await autocompleteLocalities(
                  locality.name,
                  undefined,
                  {
                    focus:
                      candidate.point,

                    boundedToFocus:
                      true,
                  },
                )

              const ranked =
                rankAutocompleteSuggestions(
                  locality.name,
                  localities,
                  candidate.point,
                )

              if (
                ranked[0]
              ) {
                place = {
                  ...ranked[0],
                }
              }
            } catch {
              // Il punto stradale con nome località resta un fallback valido.
            }

            const projectedKm =
              roadKmAtPoint(
                routePlan,
                place,
              ) ??
              candidate.routeKm

            const deviationKm =
              distanceMeters(
                candidate.point,
                place,
              ) /
              1000

            options.push({
              place,

              routeKm:
                projectedKm,

              score:
                Math.abs(
                  projectedKm -
                  targetKm,
                ) +
                deviationKm *
                  1.5,
            })
          } catch {
            options.push({
              place: {
                id:
                  `day-boundary:${candidate.routeKm.toFixed(1)}`,

                name:
                  `Fine giornata km ${candidate.routeKm.toFixed(0)}`,

                label:
                  'Punto provvisorio sulla traccia',

                lat:
                  candidate
                    .point
                    .lat,

                lng:
                  candidate
                    .point
                    .lng,
              },

              routeKm:
                candidate
                  .routeKm,

              score:
                Math.abs(
                  candidate
                    .routeKm -
                  targetKm,
                ) +
                100,
            })
          }
        }

        return (
          options.sort(
            (
              first,
              second,
            ) =>
              first.score -
              second.score,
          )[0] ??
          null
        )
      },
      [
        routePlan,
      ],
    )

  const generateDays =
    useCallback(
      async (
        requestedTargets?:
          number[],
      ) => {
        if (
          !routePlan ||
          !startPlace ||
          !destinationPlace
        ) {
          return
        }

        if (
          !settings.departureDate
        ) {
          onStatus?.(
            'Imposta prima le date del viaggio nelle Impostazioni.',
          )

          return
        }

        if (
          plannedDays <=
          1
        ) {
          const date =
            settings
              .departureDate

          onChange([
            {
              id:
                dayId(
                  0,
                  date,
                ),

              dayNumber:
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
                    startPlace.name,
                },
                {
                  kind:
                    'place',
                  name:
                    destinationPlace.name,
                },
              ],

              notes:
                [],

              plannedDistanceMeters:
                roadKm *
                1000,

              routingOverride: {
                startPlace: {
                  ...startPlace,
                },

                destinationPlace: {
                  ...destinationPlace,
                },

                waypoints:
                  masterWaypoints.map(
                    cloneWaypoint,
                  ),
              },
            },
          ])

          return
        }

        setBusy(
          true,
        )

        try {
          const targets =
            normalizedDayTargets(
              roadKm,
              requestedTargets ??
                dayTargets,
              plannedDays,
            )

          const cumulative =
            cumulativeTargetsKm(
              targets,
            )

          const boundaries:
            Array<{
              place:
                GeocodingResult
              routeKm:
                number
            }> = []

          for (
            const target
            of cumulative
          ) {
            const resolved =
              await resolveBoundary(
                target,
              )

            if (!resolved) {
              throw new Error(
                `Non riesco a trovare una località adatta intorno al km ${target.toFixed(0)}.`,
              )
            }

            boundaries.push({
              place:
                resolved.place,

              routeKm:
                resolved.routeKm,
            })
          }

          const places: GeocodingResult[] = [
            startPlace,
            ...boundaries.map(
              (
                boundary,
              ) =>
                boundary.place,
            ),
            destinationPlace,
          ]

          const cumulativeKm = [
            0,
            ...boundaries.map(
              (
                boundary,
              ) =>
                boundary.routeKm,
            ),
            roadKm,
          ]

          const waypointPositions =
            masterWaypoints
              .map(
                (
                  waypoint,
                ) => ({
                  waypoint,

                  routeKm:
                    roadKmAtPoint(
                      routePlan,
                      waypoint,
                    ),
                }),
              )
              .filter(
                (
                  item,
                ): item is {
                  waypoint:
                    Waypoint
                  routeKm:
                    number
                } =>
                  item.routeKm !==
                  null,
              )

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
                settings
                  .departureDate,
                index,
              )

            const checkOut =
              addDays(
                settings
                  .departureDate,
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

            const hasOvernight =
              index <
              places.length -
                2

            const previousDay =
              days[
                index
              ]

            const distanceKm =
              Math.max(
                0,
                cumulativeKm[
                  index +
                    1
                ] -
                  cumulativeKm[
                    index
                  ],
              )

            nextDays.push({
              id:
                previousDay
                  ?.id ??
                dayId(
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
                previousDay
                  ?.notes
                  ? [
                      ...previousDay
                        .notes,
                    ]
                  : [],

              plannedDistanceMeters:
                distanceKm *
                1000,

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

                      hotelDisplay:
                        previousDay
                          ?.overnight
                          ?.hotelDisplay,

                      priceEur:
                        previousDay
                          ?.overnight
                          ?.priceEur,
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
                  waypointPositions
                    .filter(
                      (
                        item,
                      ) =>
                        item.routeKm >
                          cumulativeKm[
                            index
                          ] +
                            0.05 &&
                        item.routeKm <
                          cumulativeKm[
                            index +
                              1
                          ] -
                            0.05,
                    )
                    .map(
                      (
                        item,
                      ) =>
                        cloneWaypoint(
                          item.waypoint,
                        ),
                    ),
              },
            })
          }

          setDayTargets(
            nextDays.map(
              (
                day,
              ) =>
                (
                  day
                    .plannedDistanceMeters ??
                  0
                ) /
                1000,
            ),
          )

          onChange(
            nextDays,
          )

          onStatus?.(
            `Percorso suddiviso automaticamente in ${nextDays.length} giornate, con fine tappa vicino a località utili.`,
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
              : 'Errore durante la generazione automatica delle tappe.',
          )
        } finally {
          setBusy(
            false,
          )
        }
      },
      [
        routePlan,
        startPlace,
        destinationPlace,
        settings.departureDate,
        plannedDays,
        roadKm,
        dayTargets,
        masterWaypoints,
        days,
        onChange,
        onStatus,
        resolveBoundary,
      ],
    )

  useEffect(
    () => {
      if (
        !routePlan ||
        !startPlace ||
        !destinationPlace ||
        !settings
          .departureDate ||
        plannedDays <=
          1 ||
        days.length >
          0 ||
        busy
      ) {
        return
      }

      const key =
        [
          startPlace.id,
          destinationPlace.id,
          plannedDays,
          Math.round(
            roadKm,
          ),
        ].join(
          '|',
        )

      if (
        autoKeyRef.current ===
        key
      ) {
        return
      }

      autoKeyRef.current =
        key

      void generateDays(
        equalTargets(
          roadKm,
          plannedDays,
        ),
      )
    },
    [
      routePlan,
      startPlace,
      destinationPlace,
      settings.departureDate,
      plannedDays,
      roadKm,
      days.length,
      busy,
      generateDays,
    ],
  )

  const updateDistance =
    (
      index:
        number,
      rawValue:
        number,
    ) => {
      const count =
        plannedDays

      if (
        count <=
        1 ||
        index >=
        count -
          1
      ) {
        return
      }

      const minimumKm =
        1

      const current =
        normalizedDayTargets(
          roadKm,
          dayTargets,
          count,
        )

      const usedBefore =
        current
          .slice(
            0,
            index,
          )
          .reduce(
            (
              total,
              value,
            ) =>
              total +
              value,
            0,
          )

      const remainingSlots =
        count -
        index -
        1

      const maximumCurrent =
        Math.max(
          minimumKm,
          roadKm -
            usedBefore -
            minimumKm *
              remainingSlots,
        )

      const chosen =
        Math.max(
          minimumKm,
          Math.min(
            maximumCurrent,
            rawValue,
          ),
        )

      const remaining =
        Math.max(
          minimumKm *
            remainingSlots,
          roadKm -
            usedBefore -
            chosen,
        )

      const equalRemaining =
        remaining /
        remainingSlots

      const next = [
        ...current,
      ]

      next[
        index
      ] =
        chosen

      for (
        let nextIndex =
          index +
          1;
        nextIndex <
          count;
        nextIndex +=
          1
      ) {
        next[
          nextIndex
        ] =
          equalRemaining
      }

      setDayTargets(
        next,
      )
    }

  const closeHotelEditor =
    () => {
      hotelAutocompleteControllerRef
        .current
        ?.abort()

      hotelAutocompleteControllerRef.current =
        null

      setHotelEditDayId(
        null,
      )

      setHotelQuery('')
      setHotelResults([])
      setHotelLoading(false)
    }

  const openHotelEditor =
    (
      day:
        TripDay,
    ) => {
      hotelAutocompleteControllerRef
        .current
        ?.abort()

      hotelAutocompleteControllerRef.current =
        null

      setHotelEditDayId(
        day.id,
      )

      setHotelQuery('')
      setHotelResults([])
      setHotelLoading(false)
    }

  const searchHotel =
    async (
      day:
        TripDay,
    ) => {
      const cleanQuery =
        hotelQuery.trim()

      if (
        cleanQuery.length <
        3
      ) {
        onStatus?.(
          'Scrivi almeno 3 caratteri per cercare hotel, indirizzo o POI.',
        )

        return
      }

      hotelAutocompleteControllerRef
        .current
        ?.abort()

      const controller =
        new AbortController()

      hotelAutocompleteControllerRef.current =
        controller

      const focus =
        day.overnight
          ? {
              lat:
                day.overnight.lat,
              lng:
                day.overnight.lng,
            }
          : day
              .routingOverride
              ?.destinationPlace
            ? {
                lat:
                  day
                    .routingOverride
                    .destinationPlace
                    .lat,
                lng:
                  day
                    .routingOverride
                    .destinationPlace
                    .lng,
              }
            : undefined

      try {
        setHotelLoading(
          true,
        )

        const results =
          await autocompletePlaces(
            cleanQuery,
            controller.signal,
            {
              focus,
            },
          )

        if (
          controller
            .signal
            .aborted
        ) {
          return
        }

        const ranked =
          rankAutocompleteSuggestions(
            cleanQuery,
            results.filter(
              (
                result,
              ) =>
                result.kind !==
                'ferry-terminal',
            ),
            focus,
          )

        setHotelResults(
          ranked.slice(
            0,
            8,
          ),
        )

        if (
          ranked.length ===
          0
        ) {
          onStatus?.(
            'Nessun hotel, indirizzo o POI trovato.',
          )
        }
      } catch (error) {
        if (
          error instanceof
            DOMException &&
          error.name ===
            'AbortError'
        ) {
          return
        }

        console.error(
          error,
        )

        setHotelResults(
          [],
        )

        onStatus?.(
          error instanceof
            Error
            ? error.message
            : 'Errore durante la ricerca dell’hotel.',
        )
      } finally {
        if (
          !controller
            .signal
            .aborted
        ) {
          setHotelLoading(
            false,
          )
        }
      }
    }

  const selectHotelResult =
    async (
      day:
        TripDay,
      result:
        SmartGeocodingResult,
    ) => {
      if (
        !onSetOvernightDestination
      ) {
        return
      }

      try {
        setHotelLoading(
          true,
        )

        await onSetOvernightDestination(
          day,
          result,
        )

        closeHotelEditor()

        setOpenDayId(
          day.id,
        )
      } catch (error) {
        console.error(
          error,
        )

        setHotelLoading(
          false,
        )

        onStatus?.(
          error instanceof
            Error
            ? error.message
            : 'Errore durante l’impostazione dell’hotel.',
        )
      }
    }

  if (
    !routePlan ||
    !startPlace ||
    !destinationPlace
  ) {
    return null
  }

  return (
    <div className="itinerary-day-planner">
      <div className="itinerary-day-planner-heading">
        <div>
          <strong>
            Tappe giornaliere
          </strong>

          <span>
            {plannedDays} {plannedDays === 1 ? 'giorno' : 'giorni'} disponibili · {roadKm.toFixed(0)} km strada
          </span>
        </div>

        <button
          type="button"
          disabled={
            busy ||
            !settings
              .departureDate
          }
          onClick={() =>
            void generateDays(
              dayTargets,
            )
          }
        >
          {busy
            ? 'Calcolo tappe...'
            : days.length > 0
              ? 'Ricalcola'
              : 'Genera'}
        </button>
      </div>

      {!settings
        .departureDate && (
        <div className="itinerary-day-planner-warning">
          Imposta data di partenza e rientro nelle Impostazioni per generare automaticamente le giornate.
        </div>
      )}

      {days.length >
        0 && (
        <div className="itinerary-day-strip-list">
          {days.map(
            (
              day,
              index,
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

              const plannedKm =
                (
                  day
                    .plannedDistanceMeters ??
                  0
                ) /
                1000

              const open =
                openDayId ===
                day.id

              const dayTarget =
                normalizedDayTargets(
                  roadKm,
                  dayTargets,
                  plannedDays,
                )[
                  index
                ] ??
                plannedKm

              return (
                <div
                  key={
                    day.id
                  }
                  className={
                    open
                      ? 'itinerary-day-strip-wrap open'
                      : 'itinerary-day-strip-wrap'
                  }
                >
                  <div className="itinerary-day-strip">
                    <span className="itinerary-day-strip-badge">
                      G{day.dayNumber}
                    </span>

                    <div className="itinerary-day-strip-main">
                      <strong>
                        Giorno {day.dayNumber}: {from?.name ?? '—'} → {to?.name ?? '—'}
                      </strong>

                      <span>
                        {day.dateLabel}
                        {' · '}
                        {(stats
                          ? stats.distanceMeters /
                              1000
                          : plannedKm
                        ).toFixed(0)} km
                        {stats && (
                          <>
                            {' · '}
                            ~{formatDuration(
                              stats.durationSeconds,
                            )} guida
                          </>
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="itinerary-day-strip-menu"
                      aria-label={
                        open
                          ? 'Chiudi menu giornata'
                          : 'Apri menu giornata'
                      }
                      onClick={() =>
                        setOpenDayId(
                          open
                            ? null
                            : day.id,
                        )
                      }
                    >
                      {open
                        ? '⌃'
                        : '⋮'}
                    </button>
                  </div>

                  {open && (
                    <div className="itinerary-day-strip-menu-panel">
                      <div className="itinerary-day-strip-menu-section">
                        <span className="itinerary-day-strip-menu-title">
                          Percorso Giorno {day.dayNumber}
                        </span>

                        <div className="itinerary-day-strip-timeline">
                          <div>
                            <b>
                              A
                            </b>

                            <span>
                              {from?.name ?? '—'}
                            </span>
                          </div>

                          {day.routingOverride
                            ?.waypoints
                            .map(
                              (
                                waypoint,
                                waypointIndex,
                              ) => (
                                <div
                                  key={
                                    waypoint.id
                                  }
                                >
                                  <b>
                                    {waypointIndex + 1}
                                  </b>

                                  <span>
                                    {waypoint.label ||
                                      waypoint.name}
                                  </span>
                                </div>
                              ),
                            )}

                          <div>
                            <b>
                              B
                            </b>

                            <span>
                              {to?.name ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {plannedDays >
                        1 && (
                        <div className="itinerary-day-strip-km">
                          <label>
                            Km tappa
                          </label>

                          <div>
                            <EditableNumberInput
                              min={1}
                              step={1}
                              fallback={1}
                              value={
                                Math.round(
                                  dayTarget,
                                )
                              }
                              disabled={
                                index ===
                                  plannedDays -
                                    1 ||
                                busy
                              }
                              onCommit={(
                                value,
                              ) => {
                                updateDistance(
                                  index,
                                  value ??
                                    1,
                                )

                                void generateDays(
                                  dayTargets,
                                )
                              }}
                            />

                            <span>
                              km
                            </span>
                          </div>

                          {index ===
                            plannedDays -
                              1 && (
                            <small>
                              Ultima giornata = distanza residua automatica.
                            </small>
                          )}
                        </div>
                      )}

                      {day.overnight && (
                        <div className="itinerary-day-strip-hotel">
                          <span>
                            Pernottamento
                          </span>

                          <strong>
                            {day.overnight.hotelDisplay ??
                              day.overnight.label ??
                              'Hotel non definito'}
                          </strong>
                        </div>
                      )}

                      <div className="itinerary-day-strip-actions">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDay(
                              day,
                            )
                          }
                        >
                          Mostra / modifica percorso
                        </button>

                        {day.overnight && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                hotelEditDayId ===
                                day.id
                              ) {
                                closeHotelEditor()

                                return
                              }

                              openHotelEditor(
                                day,
                              )
                            }}
                          >
                            Inserisci hotel / arrivo preciso
                          </button>
                        )}
                      </div>

                      {day.overnight &&
                        hotelEditDayId ===
                          day.id && (
                        <div className="itinerary-day-hotel-editor">
                          <label>
                            Hotel, indirizzo o POI
                          </label>

                          <div className="itinerary-day-hotel-search">
                            <input
                              type="text"
                              value={
                                hotelQuery
                              }
                              autoFocus
                              autoComplete="off"
                              placeholder="Es. Hotel Felcaro, Cormons"
                              onChange={(
                                event,
                              ) => {
                                setHotelQuery(
                                  event
                                    .target
                                    .value,
                                )

                                setHotelResults(
                                  [],
                                )
                              }}
                              onKeyDown={(
                                event,
                              ) => {
                                if (
                                  event.key !==
                                  'Enter'
                                ) {
                                  return
                                }

                                event.preventDefault()

                                void searchHotel(
                                  day,
                                )
                              }}
                            />

                            <button
                              type="button"
                              disabled={
                                hotelLoading
                              }
                              onClick={() =>
                                void searchHotel(
                                  day,
                                )
                              }
                            >
                              {hotelLoading
                                ? 'Cerco...'
                                : 'Cerca'}
                            </button>

                            <button
                              type="button"
                              className="itinerary-day-hotel-cancel"
                              onClick={
                                closeHotelEditor
                              }
                            >
                              Annulla
                            </button>
                          </div>

                          {hotelResults.length >
                            0 && (
                            <div className="itinerary-day-hotel-results">
                              {hotelResults.map(
                                (
                                  result,
                                ) => (
                                  <button
                                    key={
                                      result.id
                                    }
                                    type="button"
                                    onClick={() =>
                                      void selectHotelResult(
                                        day,
                                        result,
                                      )
                                    }
                                  >
                                    <strong>
                                      {result.name}
                                    </strong>

                                    <span>
                                      {result.label}
                                    </span>
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            },
          )}
        </div>
      )}
    </div>
  )
}
