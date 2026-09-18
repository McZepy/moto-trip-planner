import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react'

import {
  LngLatBounds,
  Map,
  type MapMouseEvent,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
} from 'maplibre-gl'

import 'maplibre-gl/dist/maplibre-gl.css'

import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import './App.css'
import './components/WaypointDrag.css'
import './components/SmartSearch.css'

import { mapProvider } from './config/mapProvider'

import {
  type RoutePoint,
} from './providers/routingProvider'

import {
  createTomTomRoutingProvider,
} from './providers/tomTomRoutingProvider'

import {
  multiLegPlanToTripRoutePlan,
  planMultiLegRoute,
} from './providers/multiLegTripPlanner'

import type {
  TripRoutePlan,
} from './providers/tripRoutePlanner'

import {
  clearPlannedRoute,
  drawPlannedRoute,
} from './map/routeSectionRenderer'

import type {
  GeocodingResult,
} from './providers/geocodingProvider'

import {
  autocompletePlaces,
  reverseLookupPoint,
  type PortResultGroup,
  type SmartGeocodingResult,
} from './providers/autocompleteProvider'
import {
  rankAutocompleteSuggestions,
} from './providers/autocompleteRanking'

import {
  isAreaResult,
  resolveRoadPoint,
  resolveZonePassPoint,
} from './providers/waypointResolver'

import {
  deleteTrip,
  duplicateTrip,
  getSavedTrips,
  saveTrip,
  type TripRecord,
} from './storage/tripStorage'

import {
  defaultTripSettings,
  type TripSettings,
} from './types/trip'

import {
  type Waypoint,
  type WaypointType,
} from './types/waypoint'

import type { TripDay } from './types/tripDay'
import {
  clearTripDayPlaceCache,
  planTripDaysRoute,
  resolveTripDayEditorDraft,
  type TripDayRouteStats,
} from './itinerary/tripDayRoutePlanner'
import { showTripRoutePlan } from './map/showTripRoutePlan'
import { TripsModal } from './components/TripsModal'
import { TripSettingsModal } from './components/TripSettingsModal'
import { DaysHotelPanel } from './components/DaysHotelPanel'

setWorkerUrl(workerUrl)

type ActiveSection =
  | 'itinerary'
  | 'fuel'
  | 'breaks'
  | 'days'

type EditingWaypoint = {
  id: string
  query: string
  results: SmartGeocodingResult[]
  loading: boolean
}

type PendingAreaSelection = {
  result: GeocodingResult
  waypointId: string
  insertIndex: number | null
  replaceIndex: number | null
}

type PendingRoadPointSelection = {
  waypointId: string
  insertIndex: number | null
  replaceIndex: number | null
}

type PendingEndpointMapSelection =
  | 'start'
  | 'destination'
  | null

type DayEditorSnapshot = {
  startPlace:
    GeocodingResult | null

  destinationPlace:
    GeocodingResult | null

  waypoints:
    Waypoint[]

  distance:
    number | null

  duration:
    number | null
}

function createId() {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
}

function cloneTripSettings(
  settings: TripSettings,
): TripSettings {
  return {
    ...settings,

    roadPreferences: {
      ...settings.roadPreferences,
    },
  }
}

function tripDaysBetween(
  departureDate:
    string,
  returnDate:
    string,
) {
  if (
    !departureDate ||
    !returnDate
  ) {
    return null
  }

  const start =
    new Date(
      departureDate +
        'T12:00:00',
    )

  const end =
    new Date(
      returnDate +
        'T12:00:00',
    )

  const difference =
    Math.round(
      (
        end.getTime() -
        start.getTime()
      ) /
      86_400_000,
    )

  if (
    !Number.isFinite(
      difference,
    ) ||
    difference <
      0
  ) {
    return null
  }

  return difference + 1
}

function createRoadRoutingProvider(
  settings: TripSettings,
) {
  return createTomTomRoutingProvider({
    routeStyle:
      settings.routeStyle,
    roadPreferences:
      settings.roadPreferences,
    traffic:
      false,
  })
}

function formatDistance(
  meters: number,
) {
  return `${(meters / 1000).toFixed(1)} km`
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

function waypointToRoutePoint(
  waypoint: Waypoint,
): RoutePoint {
  return {
    lat: waypoint.lat,
    lng: waypoint.lng,
  }
}

function waypointRoleLabel(
  type: WaypointType,
) {
  if (type === 'zone-pass') {
    return 'Passaggio'
  }

  if (type === 'road-point') {
    return 'Punto strada'
  }

  return 'Sosta'
}

function waypointRoleClass(
  type: WaypointType,
) {
  if (type === 'zone-pass') {
    return 'role-pass'
  }

  if (type === 'road-point') {
    return 'role-road'
  }

  return 'role-stop'
}

function createMapMarkerElement(
  label: string,
  type:
    | 'start'
    | 'waypoint'
    | 'destination'
    | 'overnight',
) {
  const element =
    document.createElement('div')

  element.className =
    `route-map-marker route-map-marker--${type}`

  element.textContent =
    label

  return element
}

type SearchFieldProps = {
  label?: string
  placeholder: string
  value: string
  results:
    SmartGeocodingResult[]
  loading: boolean

  onChange:
    (value: string) => void

  onAutocomplete:
    (
      query: string,
    ) =>
      | void
      | SmartGeocodingResult[]
      | Promise<
          | void
          | SmartGeocodingResult[]
        >

  onSelect:
    (
      result:
        SmartGeocodingResult,
    ) => void
}

function searchKindLabel(
  result:
    SmartGeocodingResult,
) {
  if (
    result.kind ===
    'ferry-terminal'
  ) {
    return 'Terminal'
  }

  if (
    result.kind ===
    'address'
  ) {
    return 'Indirizzo'
  }

  if (
    result.kind ===
    'place'
  ) {
    return 'Località'
  }

  return 'POI'
}

function searchGroupLabel(
  group:
    PortResultGroup,
) {
  if (
    group ===
    'recommended'
  ) {
    return 'ACCESSO CONSIGLIATO'
  }

  if (
    group ===
    'company-terminal'
  ) {
    return 'TERMINAL COMPAGNIE'
  }

  return 'ALTRI PUNTI DEL PORTO'
}

function SearchField({
  label,
  placeholder,
  value,
  results,
  loading,
  onChange,
  onAutocomplete,
  onSelect,
}: SearchFieldProps) {
  const autocompleteRef =
    useRef(
      onAutocomplete,
    )

  const debounceTimerRef =
    useRef<
      number | null
    >(null)

  useEffect(() => {
    autocompleteRef.current =
      onAutocomplete
  }, [onAutocomplete])

  useEffect(() => {
    const query =
      value.trim()

    if (
      query.length < 3
    ) {
      return
    }

    if (
      debounceTimerRef.current !==
      null
    ) {
      window.clearTimeout(
        debounceTimerRef.current,
      )
    }

    debounceTimerRef.current =
      window.setTimeout(
        () => {
          debounceTimerRef.current =
            null

          void autocompleteRef
            .current(
              query,
            )
        },
        220,
      )

    return () => {
      if (
        debounceTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          debounceTimerRef.current,
        )

        debounceTimerRef.current =
          null
      }
    }
  }, [value])

  const renderResult =
    (
      result:
        SmartGeocodingResult,
    ) => (
      <button
        key={result.id}
        type="button"
        className="search-result smart-search-result"
        onClick={() =>
          onSelect(
            result,
          )
        }
      >
        <div className="smart-search-result-main">
          <div className="smart-search-result-top">
            <span
              className={
                result.kind ===
                'ferry-terminal'
                  ? 'smart-search-kind smart-search-kind--ferry'
                  : 'smart-search-kind'
              }
            >
              {searchKindLabel(
                result,
              )}
            </span>

            <strong>
              {result.name}
            </strong>
          </div>

          <span className="smart-search-result-label">
            {result.label}
          </span>
        </div>
      </button>
    )

  const portGroups:
    PortResultGroup[] = [
      'recommended',
      'company-terminal',
      'other-port',
    ]

  const hasPortGroups =
    results.some(
      (
        result,
      ) =>
        Boolean(
          result.portGroup,
        ),
    )

  return (
    <div className="search-field">
      {label && (
        <label>
          {label}
        </label>
      )}

      <div className="search-controls smart-search-controls">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          onKeyDown={(event) => {
            if (
              event.key !==
              'Enter'
            ) {
              return
            }

            event.preventDefault()

            const query =
              value.trim()

            if (
              query.length <
              3
            ) {
              return
            }

            if (
              debounceTimerRef.current !==
              null
            ) {
              window.clearTimeout(
                debounceTimerRef.current,
              )

              debounceTimerRef.current =
                null
            }

            const firstResult =
              results[0]

            if (
              firstResult
            ) {
              onSelect(
                firstResult,
              )

              return
            }

            void Promise.resolve(
              autocompleteRef
                .current(
                  query,
                ),
            ).then(
              (
                searchedResults,
              ) => {
                const first =
                  searchedResults?.[0]

                if (first) {
                  onSelect(
                    first,
                  )
                }
              },
            )
          }}
        />

        {loading && (
          <span className="smart-search-loading">
            …
          </span>
        )}
      </div>

      {value.trim().length > 0 &&
      value.trim().length < 3 && (
        <div className="smart-search-hint">
          Scrivi almeno 3 caratteri
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results smart-search-results">
          {hasPortGroups
            ? portGroups.map(
                (
                  group,
                ) => {
                  const groupResults =
                    results.filter(
                      (
                        result,
                      ) =>
                        result.portGroup ===
                        group,
                    )

                  if (
                    groupResults.length ===
                    0
                  ) {
                    return null
                  }

                  return (
                    <div
                      key={group}
                      className="smart-search-group"
                    >
                      <div className="smart-search-group-title">
                        {searchGroupLabel(
                          group,
                        )}
                      </div>

                      {groupResults.map(
                        renderResult,
                      )}
                    </div>
                  )
                },
              )
            : results.map(
                renderResult,
              )}
        </div>
      )}
    </div>
  )
}

function App() {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(
      null,
    )

  const mapRef =
    useRef<Map | null>(
      null,
    )

  const startAutocompleteControllerRef =
    useRef<AbortController | null>(
      null,
    )

  const destinationAutocompleteControllerRef =
    useRef<AbortController | null>(
      null,
    )

  const waypointAutocompleteControllerRef =
    useRef<AbortController | null>(
      null,
    )

  const startMarkerRef =
    useRef<Marker | null>(
      null,
    )

  const destinationMarkerRef =
    useRef<Marker | null>(
      null,
    )

  const waypointMarkersRef =
    useRef<
      globalThis.Map<
        string,
        Marker
      >
    >(
      new globalThis.Map(),
    )

  const overnightMarkersRef =
    useRef<
      globalThis.Map<
        string,
        Marker
      >
    >(
      new globalThis.Map(),
    )

  const dayEditorSnapshotRef =
    useRef<
      DayEditorSnapshot | null
    >(null)

  const [
    activeSection,
    setActiveSection,
  ] =
    useState<ActiveSection>(
      'itinerary',
    )

  const [
    tripName,
    setTripName,
  ] =
    useState(
      'Nuovo viaggio',
    )

  const [
    tripSettings,
    setTripSettings,
  ] =
    useState<TripSettings>(
      () =>
        cloneTripSettings(
          defaultTripSettings,
        ),
    )

  const [
    tripSettingsOpen,
    setTripSettingsOpen,
  ] =
    useState(false)

  const [
    currentTripId,
    setCurrentTripId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    savedTrips,
    setSavedTrips,
  ] =
    useState<TripRecord[]>(
      () => getSavedTrips(),
    )

  const [
    tripsModalOpen,
    setTripsModalOpen,
  ] =
    useState(false)

  const [
    startQuery,
    setStartQuery,
  ] =
    useState('')

  const [
    destinationQuery,
    setDestinationQuery,
  ] =
    useState('')

  const [
    startResults,
    setStartResults,
  ] =
    useState<
      SmartGeocodingResult[]
    >([])

  const [
    destinationResults,
    setDestinationResults,
  ] =
    useState<
      SmartGeocodingResult[]
    >([])

  const [
    startLoading,
    setStartLoading,
  ] =
    useState(false)

  const [
    destinationLoading,
    setDestinationLoading,
  ] =
    useState(false)

  const [
    startPlace,
    setStartPlace,
  ] =
    useState<
      GeocodingResult | null
    >(null)

  const [
    destinationPlace,
    setDestinationPlace,
  ] =
    useState<
      GeocodingResult | null
    >(null)

  const [
    editingStart,
    setEditingStart,
  ] =
    useState(true)

  const [
    editingDestination,
    setEditingDestination,
  ] =
    useState(true)

  const [
    waypoints,
    setWaypoints,
  ] =
    useState<
      Waypoint[]
    >([])

  const [
    days,
    setDays,
  ] =
    useState<TripDay[]>([])

  const daysRef =
    useRef<TripDay[]>(
      [],
    )

  useEffect(
    () => {
      daysRef.current =
        days
    },
    [
      days,
    ],
  )

  const [
    selectedDayId,
    setSelectedDayId,
  ] =
    useState<string | null>(null)

  const [
    editingDayId,
    setEditingDayId,
  ] =
    useState<string | null>(null)

  const [
    dayRouteStats,
    setDayRouteStats,
  ] =
    useState<Record<string, TripDayRouteStats>>({})

  const [
    daysRoutingBusy,
    setDaysRoutingBusy,
  ] =
    useState(false)

  const [
    daysRoutingProgress,
    setDaysRoutingProgress,
  ] =
    useState<string | null>(null)

  const [
    editingWaypoint,
    setEditingWaypoint,
  ] =
    useState<
      EditingWaypoint | null
    >(null)

  const [
    editingInsertIndex,
    setEditingInsertIndex,
  ] =
    useState<number | null>(
      null,
    )

  const [
    editingExistingWaypointIndex,
    setEditingExistingWaypointIndex,
  ] =
    useState<number | null>(
      null,
    )

  const [
    pendingAreaSelection,
    setPendingAreaSelection,
  ] =
    useState<
      PendingAreaSelection | null
    >(null)

  const [
    pendingRoadPointSelection,
    setPendingRoadPointSelection,
  ] =
    useState<
      PendingRoadPointSelection | null
    >(null)

  const [
    pendingEndpointMapSelection,
    setPendingEndpointMapSelection,
  ] =
    useState<
      PendingEndpointMapSelection
    >(null)

  const [
    openMenuKey,
    setOpenMenuKey,
  ] =
    useState<string | null>(
      null,
    )

  const [
    draggedWaypointIndex,
    setDraggedWaypointIndex,
  ] =
    useState<number | null>(
      null,
    )

  const [
    dragOverInsertIndex,
    setDragOverInsertIndex,
  ] =
    useState<number | null>(
      null,
    )

  const [
    distance,
    setDistance,
  ] =
    useState<number | null>(
      null,
    )

  const [
    currentRoutePlan,
    setCurrentRoutePlan,
  ] =
    useState<
      TripRoutePlan | null
    >(null)

  const [
    duration,
    setDuration,
  ] =
    useState<number | null>(
      null,
    )

  const [
    status,
    setStatus,
  ] =
    useState(
      'Inserisci partenza e destinazione.',
    )

  const pendingRoadPointWaypointId =
    pendingRoadPointSelection
      ?.waypointId ?? null

  useEffect(() => {
    if (!openMenuKey) {
      return
    }

    const handleMouseDown =
      (event: MouseEvent) => {
        const target =
          event.target

        if (
          !(target instanceof HTMLElement)
        ) {
          setOpenMenuKey(null)
          return
        }

        if (
          !target.closest(
            '.compact-role-wrap',
          )
        ) {
          setOpenMenuKey(null)
        }
      }

    const handleKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === 'Escape'
        ) {
          setOpenMenuKey(null)
        }
      }

    document.addEventListener(
      'mousedown',
      handleMouseDown,
    )

    document.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleMouseDown,
      )

      document.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [openMenuKey])

  useEffect(() => {
    if (
      !mapContainerRef.current
    ) {
      return
    }

    const map =
      new Map({
        container:
          mapContainerRef.current,

        style:
          mapProvider.styleUrl,

        center:
          [12.5, 42.5],

        zoom:
          5.5,
      })

    map.addControl(
      new NavigationControl(),
      'top-right',
    )

    mapRef.current =
      map

    return () => {
      map.remove()

      mapRef.current =
        null
    }
  }, [])

  const refreshSavedTrips =
    () => {
      setSavedTrips(
        getSavedTrips(),
      )
    }

  const removeRoute =
    () => {
      const map =
        mapRef.current

      if (!map) {
        return
      }

      clearPlannedRoute(
        map,
      )

      if (
        map.getLayer(
          'route',
        )
      ) {
        map.removeLayer(
          'route',
        )
      }

      if (
        map.getSource(
          'route',
        )
      ) {
        map.removeSource(
          'route',
        )
      }
    }

  const removeWaypointMarkers =
    () => {
      waypointMarkersRef
        .current
        .forEach(
          (marker) =>
            marker.remove(),
        )

      waypointMarkersRef
        .current
        .clear()
    }

  const syncWaypointMarkers =
    (
      items:
        Waypoint[],
    ) => {
      const map =
        mapRef.current

      if (!map) {
        return
      }

      removeWaypointMarkers()

      items.forEach(
        (
          waypoint,
          index,
        ) => {
          const marker =
            new Marker({
              element:
                createMapMarkerElement(
                  String(
                    index + 1,
                  ),
                  'waypoint',
                ),
            })
              .setLngLat([
                waypoint.lng,
                waypoint.lat,
              ])
              .setPopup(
                new Popup().setText(
                  `${index + 1}. ${waypoint.name}`,
                ),
              )
              .addTo(map)

          waypointMarkersRef
            .current
            .set(
              waypoint.id,
              marker,
            )
        },
      )
    }

  const removeOvernightMarkers =
    () => {
      overnightMarkersRef
        .current
        .forEach(
          (
            marker,
          ) =>
            marker.remove(),
        )

      overnightMarkersRef
        .current
        .clear()
    }

  const replaceBoundaryPlaceName =
    (
      steps:
        TripDay['steps'],
      edge:
        'first'
        | 'last',
      name:
        string,
    ) => {
      const indexes =
        steps
          .map(
            (
              step,
              index,
            ) =>
              step.kind ===
                'place'
                ? index
                : -1,
          )
          .filter(
            (
              index,
            ) =>
              index >=
              0,
          )

      const targetIndex =
        edge ===
          'first'
          ? indexes[0]
          : indexes.at(-1)

      if (
        targetIndex ===
        undefined
      ) {
        return steps
      }

      return steps.map(
        (
          step,
          index,
        ) =>
          index ===
            targetIndex &&
          step.kind ===
            'place'
            ? {
                ...step,
                name,
              }
            : step,
      )
    }

  const buildDaysWithBoundaryPlace =
    (
      current:
        TripDay[],
      dayId:
        string,
      place:
        GeocodingResult,
    ) => {
      const index =
        current.findIndex(
          (
            day,
          ) =>
            day.id ===
            dayId,
        )

      if (
        index <
        0
      ) {
        return current
      }

      const next =
        current.map(
          (
            day,
          ) => ({
            ...day,

            steps:
              day.steps.map(
                (
                  step,
                ) => ({
                  ...step,
                }),
              ),

            routingOverride:
              day.routingOverride
                ? {
                    ...day.routingOverride,

                    startPlace: {
                      ...day
                        .routingOverride
                        .startPlace,
                    },

                    destinationPlace: {
                      ...day
                        .routingOverride
                        .destinationPlace,
                    },

                    waypoints:
                      cloneEditorWaypoints(
                        day
                          .routingOverride
                          .waypoints,
                      ),
                  }
                : undefined,

            overnight:
              day.overnight
                ? {
                    ...day.overnight,
                  }
                : undefined,
          }),
        )

      const currentDay =
        next[
          index
        ]

      if (
        currentDay
          .overnight
      ) {
        currentDay.overnight = {
          ...currentDay.overnight,

          name:
            place.name,

          label:
            place.label,

          lat:
            place.lat,

          lng:
            place.lng,
        }
      }

      currentDay.steps =
        replaceBoundaryPlaceName(
          currentDay.steps,
          'last',
          place.name,
        )

      if (
        currentDay
          .routingOverride
      ) {
        currentDay.routingOverride.destinationPlace = {
          ...place,
        }
      }

      const nextDay =
        next[
          index +
            1
        ]

      if (
        nextDay
      ) {
        nextDay.steps =
          replaceBoundaryPlaceName(
            nextDay.steps,
            'first',
            place.name,
          )

        if (
          nextDay
            .routingOverride
        ) {
          nextDay.routingOverride.startPlace = {
            ...place,
          }
        }
      }

      return next
    }

  const applyOvernightPlace =
    (
      dayId:
        string,
      place:
        GeocodingResult,
    ) => {
      const next =
        buildDaysWithBoundaryPlace(
          daysRef.current,
          dayId,
          place,
        )

      daysRef.current =
        next

      setDays(
        next,
      )

      return next
    }

  const syncOvernightMarkers =
    (
      items:
        TripDay[],
    ) => {
      const map =
        mapRef.current

      if (!map) {
        return
      }

      removeOvernightMarkers()

      items.forEach(
        (
          day,
        ) => {
          const overnight =
            day.overnight

          if (!overnight) {
            return
          }

          const element =
            createMapMarkerElement(
              `N${day.dayNumber}`,
              'overnight',
            )

          const marker =
            new Marker({
              element,
              draggable:
                true,
            })
              .setLngLat([
                overnight.lng,
                overnight.lat,
              ])
              .setPopup(
                new Popup().setText(
                  `Fine Giorno ${day.dayNumber}: ${overnight.name}`,
                ),
              )
              .addTo(
                map,
              )

          marker.on(
            'dragend',
            async () => {
              const point =
                marker.getLngLat()

              setStatus(
                `Fine Giorno ${day.dayNumber}: aggiorno il punto pernottamento...`,
              )

              try {
                const place =
                  await reverseLookupPoint({
                    lat:
                      point.lat,

                    lng:
                      point.lng,
                  })

                applyOvernightPlace(
                  day.id,
                  place,
                )

                setStatus(
                  `Fine Giorno ${day.dayNumber} spostata su ${place.name}. Premi Salva per conservarla.`,
                )
              } catch (
                error
              ) {
                console.error(
                  error,
                )

                const fallback:
                  GeocodingResult = {
                  id:
                    `overnight:${day.id}:${point.lat}:${point.lng}`,

                  name:
                    `Pernottamento Giorno ${day.dayNumber}`,

                  label:
                    `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,

                  lat:
                    point.lat,

                  lng:
                    point.lng,
                }

                applyOvernightPlace(
                  day.id,
                  fallback,
                )

                setStatus(
                  `Fine Giorno ${day.dayNumber} spostata sulla mappa.`,
                )
              }
            },
          )

          overnightMarkersRef
            .current
            .set(
              day.id,
              marker,
            )
        },
      )
    }

  useEffect(
    () => {
      syncOvernightMarkers(
        days,
      )

      return () => {
        removeOvernightMarkers()
      }
    },
    [
      days,
    ],
  )

  const clearRouteData =
    () => {
      removeRoute()

      setCurrentRoutePlan(
        null,
      )

      setDistance(null)
      setDuration(null)
    }

  const closeWaypointEditor =
    () => {
      setEditingWaypoint(
        null,
      )

      setEditingInsertIndex(
        null,
      )

      setEditingExistingWaypointIndex(
        null,
      )
    }

  const cancelPendingRoadPoint =
    () => {
      setPendingRoadPointSelection(
        null,
      )

      setStatus(
        'Selezione Punto strada annullata.',
      )
    }

  const resetTrip =
    () => {
      startMarkerRef
        .current
        ?.remove()

      destinationMarkerRef
        .current
        ?.remove()

      startMarkerRef.current =
        null

      destinationMarkerRef.current =
        null

      removeWaypointMarkers()
      removeOvernightMarkers()
      removeRoute()

      setTripName(
        'Nuovo viaggio',
      )

      setTripSettings(
        cloneTripSettings(
          defaultTripSettings,
        ),
      )

      setTripSettingsOpen(
        false,
      )

      setCurrentTripId(
        null,
      )

      setStartQuery('')
      setDestinationQuery('')

      setStartResults([])
      setDestinationResults([])

      setStartPlace(null)
      setDestinationPlace(null)

      setEditingStart(true)
      setEditingDestination(true)

      setWaypoints([])
      setDays([])
      setSelectedDayId(null)
      setEditingDayId(null)
      dayEditorSnapshotRef.current =
        null
      setDayRouteStats({})
      setDaysRoutingBusy(false)
      setDaysRoutingProgress(null)
      clearTripDayPlaceCache()

      closeWaypointEditor()

      setPendingAreaSelection(
        null,
      )

      setPendingRoadPointSelection(
        null,
      )

      setPendingEndpointMapSelection(
        null,
      )

      setOpenMenuKey(
        null,
      )

      setDraggedWaypointIndex(
        null,
      )

      setDragOverInsertIndex(
        null,
      )

      setCurrentRoutePlan(
        null,
      )
      setDistance(null)
      setDuration(null)

      setStatus(
        'Inserisci partenza e destinazione.',
      )

      setActiveSection(
        'itinerary',
      )

      mapRef.current?.flyTo({
        center:
          [12.5, 42.5],

        zoom:
          5.5,
      })
    }

  const handleSaveTrip =
    () => {
      const cleanName =
        tripName.trim()

      if (!cleanName) {
        setStatus(
          'Inserisci un nome per il viaggio.',
        )

        return
      }

      if (
        (!startPlace ||
          !destinationPlace) &&
        days.length === 0
      ) {
        setStatus(
          'Imposta partenza e destinazione oppure crea almeno una giornata prima di salvare.',
        )

        return
      }

      if (
        pendingRoadPointSelection
      ) {
        setStatus(
          'Completa prima la selezione del Punto strada sulla mappa.',
        )

        return
      }

      const saved =
        saveTrip(
          {
            name:
              cleanName,

            startPlace,

            destinationPlace,

            waypoints,

            days,

            settings:
              cloneTripSettings(
                tripSettings,
              ),

            distance,

            duration,
          },

          currentTripId,
        )

      setCurrentTripId(
        saved.id,
      )

      setTripName(
        saved.name,
      )

      setTripSettings(
        cloneTripSettings(
          saved.settings,
        ),
      )

      setDays(
        saved.days ?? [],
      )

      refreshSavedTrips()

      setStatus(
        `Viaggio "${saved.name}" salvato.`,
      )
    }

  const loadTrip =
    (
      trip:
        TripRecord,
    ) => {
      const map =
        mapRef.current

      startMarkerRef
        .current
        ?.remove()

      destinationMarkerRef
        .current
        ?.remove()

      startMarkerRef.current =
        null

      destinationMarkerRef.current =
        null

      removeWaypointMarkers()
      removeRoute()

      setCurrentTripId(
        trip.id,
      )

      setTripName(
        trip.name,
      )

      setTripSettings(
        cloneTripSettings(
          trip.settings,
        ),
      )

      setStartPlace(
        trip.startPlace,
      )

      setDestinationPlace(
        trip.destinationPlace,
      )

      setStartQuery(
        trip.startPlace
          ?.name ?? '',
      )

      setDestinationQuery(
        trip.destinationPlace
          ?.name ?? '',
      )

      setEditingStart(
        !trip.startPlace,
      )

      setEditingDestination(
        !trip.destinationPlace,
      )

      setStartResults([])
      setDestinationResults([])

      setWaypoints(
        trip.waypoints ?? [],
      )

      setDays(
        trip.days ?? [],
      )

      setSelectedDayId(null)
      setEditingDayId(null)
      dayEditorSnapshotRef.current =
        null
      setDayRouteStats({})
      setDaysRoutingBusy(false)
      setDaysRoutingProgress(null)
      clearTripDayPlaceCache()

      setDistance(
        trip.distance,
      )

      setDuration(
        trip.duration,
      )

      closeWaypointEditor()

      setOpenMenuKey(
        null,
      )

      setPendingRoadPointSelection(
        null,
      )

      setPendingEndpointMapSelection(
        null,
      )

      setDraggedWaypointIndex(
        null,
      )

      setDragOverInsertIndex(
        null,
      )

      if (
        map &&
        trip.startPlace
      ) {
        startMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'A',
                'start',
              ),
          })
            .setLngLat([
              trip.startPlace.lng,
              trip.startPlace.lat,
            ])
            .addTo(map)
      }

      if (
        map &&
        trip.destinationPlace
      ) {
        destinationMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'B',
                'destination',
              ),
          })
            .setLngLat([
              trip.destinationPlace.lng,
              trip.destinationPlace.lat,
            ])
            .addTo(map)
      }

      syncWaypointMarkers(
        trip.waypoints ?? [],
      )

      setActiveSection(
        (trip.days?.length ?? 0) > 0
          ? 'days'
          : 'itinerary',
      )

      setTripsModalOpen(
        false,
      )

      setStatus(
        `Viaggio "${trip.name}" caricato.`,
      )
    }

  const handleDuplicateTrip =
    (
      trip:
        TripRecord,
    ) => {
      const copy =
        duplicateTrip(
          trip.id,
        )

      if (!copy) {
        return
      }

      refreshSavedTrips()
      loadTrip(copy)

      setStatus(
        `Creata e caricata "${copy.name}".`,
      )
    }

  const handleDeleteTrip =
    (
      trip:
        TripRecord,
    ) => {
      deleteTrip(
        trip.id,
      )

      if (
        currentTripId ===
        trip.id
      ) {
        resetTrip()
      }

      refreshSavedTrips()

      setStatus(
        `Viaggio "${trip.name}" eliminato.`,
      )
    }

  const cloneEditorWaypoints =
    (
      source:
        Waypoint[],
    ) =>
      source.map(
        (waypoint) => ({
          ...waypoint,

          boundingBox:
            waypoint.boundingBox
              ? {
                  ...waypoint.boundingBox,
                }
              : undefined,
        }),
      )

  const restoreDayEditorWorkspace =
    () => {
      const snapshot =
        dayEditorSnapshotRef
          .current

      if (!snapshot) {
        return
      }

      const map =
        mapRef.current

      startMarkerRef
        .current
        ?.remove()

      destinationMarkerRef
        .current
        ?.remove()

      startMarkerRef.current =
        null

      destinationMarkerRef.current =
        null

      removeWaypointMarkers()
      removeRoute()

      setStartPlace(
        snapshot.startPlace,
      )

      setDestinationPlace(
        snapshot.destinationPlace,
      )

      setStartQuery(
        snapshot.startPlace
          ?.name ?? '',
      )

      setDestinationQuery(
        snapshot.destinationPlace
          ?.name ?? '',
      )

      setEditingStart(
        !snapshot.startPlace,
      )

      setEditingDestination(
        !snapshot
          .destinationPlace,
      )

      setWaypoints(
        cloneEditorWaypoints(
          snapshot.waypoints,
        ),
      )

      setDistance(
        snapshot.distance,
      )

      setDuration(
        snapshot.duration,
      )

      if (
        map &&
        snapshot.startPlace
      ) {
        startMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'A',
                'start',
              ),
          })
            .setLngLat([
              snapshot.startPlace
                .lng,
              snapshot.startPlace
                .lat,
            ])
            .addTo(map)
      }

      if (
        map &&
        snapshot
          .destinationPlace
      ) {
        destinationMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'B',
                'destination',
              ),
          })
            .setLngLat([
              snapshot
                .destinationPlace
                .lng,
              snapshot
                .destinationPlace
                .lat,
            ])
            .addTo(map)
      }

      syncWaypointMarkers(
        snapshot.waypoints,
      )

      dayEditorSnapshotRef.current =
        null
    }

  const handleDaysChange =
    (nextDays: TripDay[]) => {
      daysRef.current =
        nextDays

      setDays(nextDays)
      setSelectedDayId(null)
      setEditingDayId(null)
      dayEditorSnapshotRef.current =
        null
      setDayRouteStats({})
      setDaysRoutingProgress(null)
      clearTripDayPlaceCache()

      /*
       * Le giornate sono una suddivisione del percorso master:
       * la traccia principale resta invariata.
       */
    }

  const handleSelectDayRoute =
    async (day: TripDay) => {
      const map =
        mapRef.current

      if (
        !map ||
        daysRoutingBusy
      ) {
        return
      }

      setDaysRoutingBusy(true)
      setSelectedDayId(
        day.id,
      )

      setDaysRoutingProgress(
        'Giorno ' +
          day.dayNumber +
          ': preparo Itinerario & Tappe...',
      )

      try {
        if (
          !editingDayId &&
          !dayEditorSnapshotRef
            .current
        ) {
          dayEditorSnapshotRef.current = {
            startPlace,
            destinationPlace,
            waypoints:
              cloneEditorWaypoints(
                waypoints,
              ),
            distance,
            duration,
          }
        }

        const draft =
          await resolveTripDayEditorDraft(
            day,
          )

        startMarkerRef
          .current
          ?.remove()

        destinationMarkerRef
          .current
          ?.remove()

        startMarkerRef.current =
          null

        destinationMarkerRef.current =
          null

        removeWaypointMarkers()
        removeRoute()

        setStartPlace(
          draft.startPlace,
        )

        setDestinationPlace(
          draft.destinationPlace,
        )

        setStartQuery(
          draft.startPlace.name,
        )

        setDestinationQuery(
          draft
            .destinationPlace
            .name,
        )

        setStartResults([])
        setDestinationResults([])

        setEditingStart(false)
        setEditingDestination(false)

        setWaypoints(
          cloneEditorWaypoints(
            draft.waypoints,
          ),
        )

        startMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'A',
                'start',
              ),
          })
            .setLngLat([
              draft.startPlace.lng,
              draft.startPlace.lat,
            ])
            .addTo(map)

        destinationMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'B',
                'destination',
              ),
          })
            .setLngLat([
              draft.destinationPlace
                .lng,
              draft.destinationPlace
                .lat,
            ])
            .addTo(map)

        syncWaypointMarkers(
          draft.waypoints,
        )

        setDistance(null)
        setDuration(null)

        setEditingDayId(
          day.id,
        )

        setActiveSection(
          'itinerary',
        )

        setStatus(
          'Giorno ' +
            day.dayNumber +
            ': percorso aperto in Itinerario & Tappe. Partenza e arrivo sono obbligatori; aggiungi solo i punti realmente necessari.',
        )
      } catch (error) {
        console.error(
          error,
        )

        setStatus(
          error instanceof Error
            ? error.message
            : 'Errore durante l’apertura della giornata.',
        )
      } finally {
        setDaysRoutingBusy(false)
        setDaysRoutingProgress(null)
      }
    }

  const handleApplyDayRoute =
    () => {
      if (
        !editingDayId ||
        !startPlace ||
        !destinationPlace
      ) {
        setStatus(
          'Partenza e arrivo della giornata devono essere impostati.',
        )

        return
      }

      if (
        pendingRoadPointSelection ||
        pendingEndpointMapSelection
      ) {
        setStatus(
          'Completa prima la selezione sulla mappa.',
        )

        return
      }

      const currentDay =
        days.find(
          (day) =>
            day.id ===
            editingDayId,
        )

      if (!currentDay) {
        setStatus(
          'Giornata da modificare non trovata.',
        )

        return
      }

      const editedDayId =
        editingDayId

      setDays(
        (current) =>
          current.map(
            (day) =>
              day.id ===
              editedDayId
                ? {
                    ...day,

                    routingOverride: {
                      startPlace: {
                        ...startPlace,
                      },

                      destinationPlace: {
                        ...destinationPlace,
                      },

                      waypoints:
                        cloneEditorWaypoints(
                          waypoints,
                        ),
                    },
                  }
                : day,
          ),
      )

      setDayRouteStats(
        (current) => {
          const updated = {
            ...current,
          }

          delete updated[
            editedDayId
          ]

          return updated
        },
      )

      clearTripDayPlaceCache()

      setEditingDayId(null)

      restoreDayEditorWorkspace()

      setActiveSection(
        'days',
      )

      setSelectedDayId(
        editedDayId,
      )

      setStatus(
        'Giorno ' +
          currentDay.dayNumber +
          ': percorso personalizzato applicato. Premi Salva per conservarlo nel viaggio.',
      )
    }

  const handleCancelDayRouteEdit =
    () => {
      const currentDay =
        editingDayId
          ? days.find(
              (day) =>
                day.id ===
                editingDayId,
            )
          : undefined

      setEditingDayId(null)

      restoreDayEditorWorkspace()

      setActiveSection(
        'days',
      )

      setStatus(
        currentDay
          ? 'Modifica del Giorno ' +
              currentDay.dayNumber +
              ' annullata.'
          : 'Modifica giornata annullata.',
      )
    }

  const handleShowTripOverview =
    async () => {
      const map = mapRef.current

      if (
        !map ||
        daysRoutingBusy ||
        days.length === 0
      ) {
        return
      }

      setDaysRoutingBusy(true)
      setSelectedDayId(null)
      setDaysRoutingProgress(
        'Calcolo viaggio completo: 0/' + days.length + ' giornate...',
      )

      try {
        const result =
          await planTripDaysRoute(
            days,
            tripSettings.roadPreferences.allowFerries,
            (completed, total, day) => {
              setDaysRoutingProgress(
                'Calcolo viaggio completo: ' +
                  completed +
                  '/' +
                  total +
                  ' · completato giorno ' +
                  day.dayNumber +
                  '.',
              )
            },
            createRoadRoutingProvider(
              tripSettings,
            ),
          )

        showTripRoutePlan(
          map,
          result.plan,
        )

        const stats =
          Object.fromEntries(
            result.dayResults.map(
              (dayResult) => [
                dayResult.day.id,
                dayResult.stats,
              ],
            ),
          ) as Record<string, TripDayRouteStats>

        setDayRouteStats(stats)
        setDistance(
          result.plan.distanceMeters,
        )
        setDuration(
          result.plan.durationSeconds,
        )

        setStatus(
          'Viaggio completo: ' +
            formatDistance(result.plan.distanceMeters) +
            ' · ' +
            formatDuration(result.plan.durationSeconds) +
            '.',
        )
      } catch (error) {
        console.error(error)
        setStatus(
          error instanceof Error
            ? error.message
            : 'Errore durante il calcolo del viaggio completo.',
        )
      } finally {
        setDaysRoutingBusy(false)
        setDaysRoutingProgress(null)
      }
    }

  const autocompleteStart =
    async (
      query:
        string,
    ) => {
      const cleanQuery =
        query.trim()

      if (
        cleanQuery.length <
        3
      ) {
        return
      }

      startAutocompleteControllerRef
        .current
        ?.abort()

      const controller =
        new AbortController()

      startAutocompleteControllerRef.current =
        controller

      try {
        setStartLoading(
          true,
        )

        const startSearchFocus =
          destinationPlace
            ? { lat: destinationPlace.lat, lng: destinationPlace.lng }
            : undefined

        const results =
          await autocompletePlaces(
            cleanQuery,
            controller.signal,
            { focus: startSearchFocus },
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
            results,
            startSearchFocus,
          )

        setStartResults(
          ranked,
        )

        return ranked
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

        setStartResults(
          [],
        )

        setStatus(
          error instanceof Error
            ? error.message
            : 'Errore durante la ricerca della partenza.',
        )
      } finally {
        if (
          !controller
            .signal
            .aborted
        ) {
          setStartLoading(
            false,
          )
        }
      }
    }

  const autocompleteDestination =
    async (
      query:
        string,
    ) => {
      const cleanQuery =
        query.trim()

      if (
        cleanQuery.length <
        3
      ) {
        return
      }

      destinationAutocompleteControllerRef
        .current
        ?.abort()

      const controller =
        new AbortController()

      destinationAutocompleteControllerRef.current =
        controller

      try {
        setDestinationLoading(
          true,
        )

        const destinationSearchFocus =
          startPlace
            ? { lat: startPlace.lat, lng: startPlace.lng }
            : undefined

        const results =
          await autocompletePlaces(
            cleanQuery,
            controller.signal,
            { focus: destinationSearchFocus },
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
            results,
            destinationSearchFocus,
          )

        setDestinationResults(
          ranked,
        )

        return ranked
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

        setDestinationResults(
          [],
        )

        setStatus(
          error instanceof Error
            ? error.message
            : 'Errore durante la ricerca della destinazione.',
        )
      } finally {
        if (
          !controller
            .signal
            .aborted
        ) {
          setDestinationLoading(
            false,
          )
        }
      }
    }

  const autocompleteIntermediate =
    async (
      query:
        string,
    ) => {
      if (
        !editingWaypoint
      ) {
        return
      }

      const cleanQuery =
        query.trim()

      if (
        cleanQuery.length <
        3
      ) {
        return
      }

      const waypointId =
        editingWaypoint.id

      waypointAutocompleteControllerRef
        .current
        ?.abort()

      const controller =
        new AbortController()

      waypointAutocompleteControllerRef.current =
        controller

      setEditingWaypoint(
        (
          current,
        ) =>
          current &&
          current.id ===
            waypointId
            ? {
                ...current,

                loading:
                  true,
              }
            : current,
      )

      try {
        const contextIndex =
          editingExistingWaypointIndex ?? editingInsertIndex

        const previousWaypoint =
          contextIndex !== null && contextIndex > 0
            ? waypoints[contextIndex - 1]
            : null

        const intermediateSearchFocus =
          previousWaypoint
            ? { lat: previousWaypoint.lat, lng: previousWaypoint.lng }
            : startPlace
              ? { lat: startPlace.lat, lng: startPlace.lng }
              : undefined

        const results =
          await autocompletePlaces(
            cleanQuery,
            controller.signal,
            { focus: intermediateSearchFocus },
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
            results,
            intermediateSearchFocus,
          )

        setEditingWaypoint(
          (
            current,
          ) =>
            current &&
            current.id ===
              waypointId
              ? {
                  ...current,

                  loading:
                    false,

                  results:
                    ranked,
                }
              : current,
        )

        return ranked
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

        setEditingWaypoint(
          (
            current,
          ) =>
            current &&
            current.id ===
              waypointId
              ? {
                  ...current,

                  loading:
                    false,

                  results:
                    [],
                }
              : current,
        )

        setStatus(
          error instanceof Error
            ? error.message
            : 'Errore durante la ricerca della tappa.',
        )
      }
    }

  const selectStart =
    (
      result:
        GeocodingResult,
    ) => {
      const map =
        mapRef.current

      clearRouteData()

      setStartPlace(
        result,
      )

      setStartQuery(
        result.name,
      )

      setStartResults([])

      setEditingStart(
        false,
      )

      setOpenMenuKey(
        null,
      )

      startMarkerRef
        .current
        ?.remove()

      if (map) {
        startMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'A',
                'start',
              ),
          })
            .setLngLat([
              result.lng,
              result.lat,
            ])
            .addTo(map)
      }

      setStatus(
        'Partenza impostata.',
      )
    }

  const selectDestination =
    (
      result:
        GeocodingResult,
    ) => {
      const map =
        mapRef.current

      clearRouteData()

      setDestinationPlace(
        result,
      )

      setDestinationQuery(
        result.name,
      )

      setDestinationResults(
        [],
      )

      setEditingDestination(
        false,
      )

      setOpenMenuKey(
        null,
      )

      destinationMarkerRef
        .current
        ?.remove()

      if (map) {
        destinationMarkerRef.current =
          new Marker({
            element:
              createMapMarkerElement(
                'B',
                'destination',
              ),
          })
            .setLngLat([
              result.lng,
              result.lat,
            ])
            .addTo(map)
      }

      setStatus(
        'Destinazione impostata.',
      )
    }

  const startEndpointMapSelection =
    (
      endpoint:
        Exclude<
          PendingEndpointMapSelection,
          null
        >,
    ) => {
      setPendingRoadPointSelection(
        null,
      )

      setPendingEndpointMapSelection(
        endpoint,
      )

      setOpenMenuKey(
        null,
      )

      clearRouteData()

      setStatus(
        endpoint ===
        'start'
          ? 'Partenza: clicca sulla strada desiderata nella mappa.'
          : 'Arrivo: clicca sulla strada desiderata nella mappa.',
      )
    }

  const cancelEndpointMapSelection =
    () => {
      setPendingEndpointMapSelection(
        null,
      )

      setStatus(
        'Selezione sulla mappa annullata.',
      )
    }

  const startInsertWaypoint =
    (
      index:
        number,
    ) => {
      setEditingExistingWaypointIndex(
        null,
      )

      setEditingInsertIndex(
        index,
      )

      setEditingWaypoint({
        id:
          createId(),

        query:
          '',

        results:
          [],

        loading:
          false,
      })

      setOpenMenuKey(
        null,
      )
    }

  const startDirectRoadPoint =
    (
      index:
        number,
    ) => {
      const waypointId =
        editingWaypoint?.id ??
        createId()

      closeWaypointEditor()

      setOpenMenuKey(
        null,
      )

      setPendingEndpointMapSelection(
        null,
      )

      setPendingRoadPointSelection({
        waypointId,

        insertIndex:
          index,

        replaceIndex:
          null,
      })

      clearRouteData()

      setStatus(
        'Punto strada: clicca direttamente sulla strada desiderata nella mappa.',
      )
    }

  const startEditWaypoint =
    (
      index:
        number,
    ) => {
      const waypoint =
        waypoints[index]

      if (!waypoint) {
        return
      }

      setEditingInsertIndex(
        null,
      )

      setEditingExistingWaypointIndex(
        index,
      )

      setEditingWaypoint({
        id:
          waypoint.id,

        query:
          waypoint.name,

        results:
          [],

        loading:
          false,
      })

      setOpenMenuKey(
        null,
      )
    }

  const applyWaypoint =
    (
      waypoint:
        Waypoint,

      insertIndex:
        number | null,

      replaceIndex:
        number | null,
    ) => {
      let updated =
        [...waypoints]

      if (
        replaceIndex !==
        null
      ) {
        updated =
          updated.map(
            (
              item,
              index,
            ) =>
              index ===
              replaceIndex
                ? waypoint
                : item,
          )
      } else if (
        insertIndex !==
        null
      ) {
        updated.splice(
          insertIndex,
          0,
          waypoint,
        )
      } else {
        return
      }

      setWaypoints(
        updated,
      )

      syncWaypointMarkers(
        updated,
      )

      closeWaypointEditor()

      clearRouteData()
    }

  const selectIntermediateWaypoint =
    (
      result:
        GeocodingResult,
    ) => {
      if (
        !editingWaypoint
      ) {
        return
      }

      const insertIndex =
        editingInsertIndex

      const replaceIndex =
        editingExistingWaypointIndex

      if (
        insertIndex ===
          null &&
        replaceIndex ===
          null
      ) {
        return
      }

      if (
        isAreaResult(
          result,
        )
      ) {
        setPendingAreaSelection({
          result,

          waypointId:
            editingWaypoint.id,

          insertIndex,

          replaceIndex,
        })

        return
      }

      const waypoint:
        Waypoint = {
          id:
            editingWaypoint.id,

          type:
            'precise-stop',

          name:
            result.name,

          label:
            result.label,

          lat:
            result.lat,

          lng:
            result.lng,

          osmType:
            result.osmType,

          osmId:
            result.osmId,

          category:
            result.category,

          sourceType:
            result.type,

          boundingBox:
            result.boundingBox,
        }

      applyWaypoint(
        waypoint,
        insertIndex,
        replaceIndex,
      )

      setStatus(
        `Sosta "${waypoint.name}" impostata.`,
      )
    }

  const confirmAreaAsZone =
    () => {
      if (
        !pendingAreaSelection
      ) {
        return
      }

      const {
        result,
        waypointId,
        insertIndex,
        replaceIndex,
      } =
        pendingAreaSelection

      if (
        !result.boundingBox
      ) {
        setStatus(
          'Questa località non dispone di un’area utilizzabile come Passaggio zona.',
        )

        setPendingAreaSelection(
          null,
        )

        return
      }

      const waypoint:
        Waypoint = {
          id:
            waypointId,

          type:
            'zone-pass',

          name:
            result.name,

          label:
            result.label,

          lat:
            result.lat,

          lng:
            result.lng,

          osmType:
            result.osmType,

          osmId:
            result.osmId,

          category:
            result.category,

          sourceType:
            result.type,

          boundingBox:
            result.boundingBox,
        }

      applyWaypoint(
        waypoint,
        insertIndex,
        replaceIndex,
      )

      setPendingAreaSelection(
        null,
      )

      setStatus(
        `"${result.name}" impostato come Passaggio.`,
      )
    }

  const confirmAreaAsCenter =
    () => {
      if (
        !pendingAreaSelection
      ) {
        return
      }

      const {
        result,
        waypointId,
        insertIndex,
        replaceIndex,
      } =
        pendingAreaSelection

      const waypoint:
        Waypoint = {
          id:
            waypointId,

          type:
            'precise-stop',

          name:
            result.name,

          label:
            result.label,

          lat:
            result.lat,

          lng:
            result.lng,

          osmType:
            result.osmType,

          osmId:
            result.osmId,

          category:
            result.category,

          sourceType:
            result.type,

          boundingBox:
            result.boundingBox,
        }

      applyWaypoint(
        waypoint,
        insertIndex,
        replaceIndex,
      )

      setPendingAreaSelection(
        null,
      )

      setStatus(
        `Centro di "${result.name}" impostato come Sosta.`,
      )
    }

  const removeWaypoint =
    (
      index:
        number,
    ) => {
      const waypoint =
        waypoints[index]

      if (
        waypoint?.id ===
        pendingRoadPointWaypointId
      ) {
        setPendingRoadPointSelection(
          null,
        )
      }

      const updated =
        waypoints.filter(
          (
            _,
            itemIndex,
          ) =>
            itemIndex !==
            index,
        )

      setWaypoints(
        updated,
      )

      syncWaypointMarkers(
        updated,
      )

      setOpenMenuKey(
        null,
      )

      clearRouteData()
    }

  const moveWaypoint =
    (
      index:
        number,

      direction:
        -1 | 1,
    ) => {
      const target =
        index +
        direction

      if (
        target < 0 ||
        target >=
          waypoints.length
      ) {
        return
      }

      const updated =
        [...waypoints]

      const [
        moved,
      ] =
        updated.splice(
          index,
          1,
        )

      updated.splice(
        target,
        0,
        moved,
      )

      setWaypoints(
        updated,
      )

      syncWaypointMarkers(
        updated,
      )

      setOpenMenuKey(
        null,
      )

      clearRouteData()
    }

  const handleWaypointDragStart =
    (
      event:
        DragEvent<HTMLElement>,

      index:
        number,
    ) => {
      setDraggedWaypointIndex(
        index,
      )

      setDragOverInsertIndex(
        null,
      )

      setOpenMenuKey(
        null,
      )

      event.dataTransfer.effectAllowed =
        'move'

      event.dataTransfer.setData(
        'text/plain',
        String(index),
      )
    }

  const handleWaypointDragOver =
    (
      event:
        DragEvent<HTMLDivElement>,

      insertIndex:
        number,
    ) => {
      event.preventDefault()

      event.dataTransfer.dropEffect =
        'move'

      setDragOverInsertIndex(
        insertIndex,
      )
    }

  const handleWaypointDrop =
    (
      event:
        DragEvent<HTMLDivElement>,

      targetInsertIndex:
        number,
    ) => {
      event.preventDefault()

      const sourceIndex =
        draggedWaypointIndex

      if (
        sourceIndex ===
        null
      ) {
        return
      }

      const updated =
        [...waypoints]

      const [
        moved,
      ] =
        updated.splice(
          sourceIndex,
          1,
        )

      let insertIndex =
        targetInsertIndex

      if (
        sourceIndex <
        targetInsertIndex
      ) {
        insertIndex -= 1
      }

      insertIndex =
        Math.max(
          0,
          Math.min(
            insertIndex,
            updated.length,
          ),
        )

      setDraggedWaypointIndex(
        null,
      )

      setDragOverInsertIndex(
        null,
      )

      if (
        sourceIndex ===
        insertIndex
      ) {
        return
      }

      updated.splice(
        insertIndex,
        0,
        moved,
      )

      setWaypoints(
        updated,
      )

      syncWaypointMarkers(
        updated,
      )

      clearRouteData()

      setStatus(
        `"${moved.name}" spostata. Percorso ricalcolato.`,
      )
    }

  const handleWaypointDragEnd =
    () => {
      setDraggedWaypointIndex(
        null,
      )

      setDragOverInsertIndex(
        null,
      )
    }

  const changeWaypointType =
    (
      index:
        number,

      type:
        WaypointType,
    ) => {
      const waypoint =
        waypoints[index]

      if (!waypoint) {
        return
      }

      if (
        type ===
        'road-point'
      ) {
        setOpenMenuKey(
          null,
        )

        setPendingEndpointMapSelection(
          null,
        )

        setPendingRoadPointSelection({
          waypointId:
            waypoint.id,

          insertIndex:
            null,

          replaceIndex:
            index,
        })

        clearRouteData()

        setStatus(
          'Punto strada: clicca sulla mappa per scegliere la nuova posizione.',
        )

        return
      }

      if (
        type ===
          'zone-pass' &&
        !waypoint.boundingBox
      ) {
        setEditingInsertIndex(
          null,
        )
      
        setEditingExistingWaypointIndex(
          index,
        )
      
        setEditingWaypoint({
          id:
            waypoint.id,
      
          query:
            '',
      
          results:
            [],
      
          loading:
            false,
        })
      
        setOpenMenuKey(
          null,
        )
      
        setStatus(
          'Passaggio: cerca e seleziona una località o area geografica.',
        )
      
        return
      }

      const updated =
        waypoints.map(
          (
            item,
            itemIndex,
          ) =>
            itemIndex ===
            index
              ? {
                  ...item,
                  type,
                }
              : item,
        )

      setWaypoints(
        updated,
      )

      setOpenMenuKey(
        null,
      )

      syncWaypointMarkers(
        updated,
      )

      clearRouteData()

      if (
        type ===
        'zone-pass'
      ) {
        setStatus(
          `"${waypoint.name}" impostato come Passaggio.`,
        )
      } else {
        setStatus(
          `"${waypoint.name}" impostato come Sosta.`,
        )
      }
    }

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !pendingEndpointMapSelection
    ) {
      return
    }

    map.getCanvas().style.cursor =
      'crosshair'

    const endpoint =
      pendingEndpointMapSelection

    const handleEndpointMapClick =
      async (
        event:
          MapMouseEvent,
      ) => {
        try {
          setStatus(
            endpoint ===
            'start'
              ? 'Aggancio la partenza alla strada più vicina...'
              : 'Aggancio l’arrivo alla strada più vicina...',
          )

          const resolved =
            await resolveRoadPoint({
              lng:
                event.lngLat.lng,

              lat:
                event.lngLat.lat,
            })

          const coordinateLabel =
            `${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`

          let reverseResult:
            GeocodingResult

          try {
            reverseResult =
              await reverseLookupPoint(
                resolved,
              )
          } catch (
            reverseError
          ) {
            console.warn(
              'Reverse geocoding non disponibile:',
              reverseError,
            )

            reverseResult = {
              id:
                `map-point-${Date.now()}`,

              name:
                coordinateLabel,

              label:
                coordinateLabel,

              lat:
                resolved.lat,

              lng:
                resolved.lng,
            }
          }

          if (
            endpoint ===
            'start'
          ) {
            const result:
              GeocodingResult = {
                ...reverseResult,

                id:
                  `map-start-${Date.now()}`,

                lat:
                  resolved.lat,

                lng:
                  resolved.lng,
              }

            setStartPlace(
              result,
            )

            setStartQuery(
              result.name,
            )

            setStartResults(
              [],
            )

            setEditingStart(
              false,
            )

            startMarkerRef
              .current
              ?.remove()

            startMarkerRef.current =
              new Marker({
                element:
                  createMapMarkerElement(
                    'A',
                    'start',
                  ),
              })
                .setLngLat([
                  result.lng,
                  result.lat,
                ])
                .addTo(
                  map,
                )
          } else {
            const result:
              GeocodingResult = {
                ...reverseResult,

                id:
                  `map-destination-${Date.now()}`,

                lat:
                  resolved.lat,

                lng:
                  resolved.lng,
              }

            setDestinationPlace(
              result,
            )

            setDestinationQuery(
              result.name,
            )

            setDestinationResults(
              [],
            )

            setEditingDestination(
              false,
            )

            destinationMarkerRef
              .current
              ?.remove()

            destinationMarkerRef.current =
              new Marker({
                element:
                  createMapMarkerElement(
                    'B',
                    'destination',
                  ),
              })
                .setLngLat([
                  result.lng,
                  result.lat,
                ])
                .addTo(
                  map,
                )
          }

          setPendingEndpointMapSelection(
            null,
          )

          clearRouteData()

          setStatus(
            endpoint ===
            'start'
              ? 'Partenza impostata dalla mappa.'
              : 'Arrivo impostato dalla mappa.',
          )
        } catch (
          error
        ) {
          console.error(
            error,
          )

          setStatus(
            error instanceof
            Error
              ? error.message
              : 'Errore durante la selezione del punto sulla mappa.',
          )
        }
      }

    map.once(
      'click',
      handleEndpointMapClick,
    )

    return () => {
      map.getCanvas().style.cursor =
        ''

      map.off(
        'click',
        handleEndpointMapClick,
      )
    }
  }, [
    pendingEndpointMapSelection,
    startPlace,
    destinationPlace,
  ])

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !pendingRoadPointSelection
    ) {
      return
    }

    const {
      waypointId,
      insertIndex,
      replaceIndex,
    } =
      pendingRoadPointSelection

    let previous:
      RoutePoint | undefined

    let next:
      RoutePoint | undefined

    if (
      replaceIndex !==
      null
    ) {
      if (
        replaceIndex === 0
      ) {
        if (startPlace) {
          previous = {
            lat:
              startPlace.lat,

            lng:
              startPlace.lng,
          }
        }
      } else {
        previous =
          waypointToRoutePoint(
            waypoints[
              replaceIndex - 1
            ],
          )
      }

      if (
        replaceIndex ===
        waypoints.length - 1
      ) {
        if (
          destinationPlace
        ) {
          next = {
            lat:
              destinationPlace.lat,

            lng:
              destinationPlace.lng,
          }
        }
      } else {
        next =
          waypointToRoutePoint(
            waypoints[
              replaceIndex + 1
            ],
          )
      }
    } else if (
      insertIndex !==
      null
    ) {
      if (
        insertIndex === 0
      ) {
        if (startPlace) {
          previous = {
            lat:
              startPlace.lat,

            lng:
              startPlace.lng,
          }
        }
      } else {
        previous =
          waypointToRoutePoint(
            waypoints[
              insertIndex - 1
            ],
          )
      }

      if (
        insertIndex >=
        waypoints.length
      ) {
        if (
          destinationPlace
        ) {
          next = {
            lat:
              destinationPlace.lat,

            lng:
              destinationPlace.lng,
          }
        }
      } else {
        next =
          waypointToRoutePoint(
            waypoints[
              insertIndex
            ],
          )
      }
    }

    map.getCanvas().style.cursor =
      'crosshair'

    const handleMapClick =
      async (
        event:
          MapMouseEvent,
      ) => {
        try {
          setStatus(
            'Aggancio il punto alla strada percorribile più adatta...',
          )

          const resolved =
            await resolveRoadPoint(
              {
                lng:
                  event.lngLat.lng,

                lat:
                  event.lngLat.lat,
              },

              previous,

              next,
            )

          const label =
            `${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`

          setWaypoints(
            (current) => {
              let updated =
                [...current]

              if (
                replaceIndex !==
                null
              ) {
                updated =
                  updated.map(
                    (
                      waypoint,
                    ) =>
                      waypoint.id ===
                      waypointId
                        ? {
                            ...waypoint,

                            type:
                              'road-point' as const,

                            name:
                              'Punto strada',

                            label,

                            lat:
                              resolved.lat,

                            lng:
                              resolved.lng,

                            boundingBox:
                              undefined,
                          }
                        : waypoint,
                  )
              } else if (
                insertIndex !==
                null
              ) {
                const waypoint:
                  Waypoint = {
                    id:
                      waypointId,

                    type:
                      'road-point',

                    name:
                      'Punto strada',

                    label,

                    lat:
                      resolved.lat,

                    lng:
                      resolved.lng,
                  }

                const safeIndex =
                  Math.max(
                    0,

                    Math.min(
                      insertIndex,
                      updated.length,
                    ),
                  )

                updated.splice(
                  safeIndex,
                  0,
                  waypoint,
                )
              }

              syncWaypointMarkers(
                updated,
              )

              return updated
            },
          )

          setPendingRoadPointSelection(
            null,
          )

          setStatus(
            'Punto strada impostato.',
          )
        } catch (error) {
          console.error(
            error,
          )

          setStatus(
            error instanceof Error
              ? error.message
              : 'Errore durante la creazione del Punto strada.',
          )
        }
      }

    map.once(
      'click',
      handleMapClick,
    )

    return () => {
      map.getCanvas().style.cursor =
        ''

      map.off(
        'click',
        handleMapClick,
      )
    }
  }, [
    pendingRoadPointSelection,
    waypoints,
    startPlace,
    destinationPlace,
  ])

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !startPlace ||
      !destinationPlace
    ) {
      return
    }

    if (
      pendingRoadPointSelection ||
      pendingEndpointMapSelection
    ) {
      return
    }

    let cancelled =
      false

    const calculateRoute =
      async () => {
        setStatus(
          'Calcolo percorso...',
        )

        try {
          const points:
            RoutePoint[] = []

          let previous:
            RoutePoint = {
              lat:
                startPlace.lat,

              lng:
                startPlace.lng,
            }

          points.push(
            previous,
          )

          for (
            let index = 0;
            index <
            waypoints.length;
            index += 1
          ) {
            const waypoint =
              waypoints[index]

            if (
              waypoint.type ===
              'zone-pass'
            ) {
              let nextReference:
                RoutePoint = {
                  lat:
                    destinationPlace.lat,

                  lng:
                    destinationPlace.lng,
                }

              for (
                let nextIndex =
                  index + 1;
                nextIndex <
                waypoints.length;
                nextIndex += 1
              ) {
                const candidate =
                  waypoints[
                    nextIndex
                  ]

                if (
                  candidate.type !==
                  'zone-pass'
                ) {
                  nextReference =
                    waypointToRoutePoint(
                      candidate,
                    )

                  break
                }
              }

              const resolved =
                await resolveZonePassPoint(
                  waypoint,

                  previous,

                  nextReference,
                )

              if (resolved) {
                points.push(
                  resolved,
                )

                previous =
                  resolved
              }

              continue
            }

            const resolved =
              waypointToRoutePoint(
                waypoint,
              )

            points.push(
              resolved,
            )

            previous =
              resolved
          }

          points.push({
            lat:
              destinationPlace.lat,

            lng:
              destinationPlace.lng,
          })

          const multiLegPlan =
            await planMultiLegRoute(
              points,

              tripSettings
                .roadPreferences
                .allowFerries,

              createRoadRoutingProvider(
                tripSettings,
              ),
            )

          if (cancelled) {
            return
          }

          const plan =
            multiLegPlanToTripRoutePlan(
              multiLegPlan,
            )

          removeRoute()

          drawPlannedRoute(
            map,
            plan,
          )

          const coordinates =
            plan.sections.flatMap(
              (
                section,
              ) =>
                section
                  .geometry
                  .coordinates,
            )

          if (
            coordinates.length >
            0
          ) {
            const bounds =
              coordinates.reduce(
                (
                  currentBounds,
                  coordinate,
                ) =>
                  currentBounds.extend(
                    coordinate as [
                      number,
                      number,
                    ],
                  ),

                new LngLatBounds(
                  coordinates[0] as [
                    number,
                    number,
                  ],

                  coordinates[0] as [
                    number,
                    number,
                  ],
                ),
              )

            map.fitBounds(
              bounds,
              {
                padding:
                  70,
              },
            )
          }

          setCurrentRoutePlan(
            plan,
          )

          setDistance(
            plan.distanceMeters,
          )

          setDuration(
            plan.durationSeconds,
          )

          if (
            plan.usesFerry
          ) {
            const sectionSummary =
              multiLegPlan.legs
                .map(
                  (
                    leg,
                  ) =>
                    leg
                      .selectedAlternative
                      .plan
                      .usesFerry
                      ? 'TRAGHETTO'
                      : 'STRADA',
                )
                .join(
                  ' → ',
                )

            const ferryLegs =
              multiLegPlan.legs
                .filter(
                  (
                    leg,
                  ) =>
                    leg
                      .selectedAlternative
                      .plan
                      .usesFerry,
                )
                .map(
                  (
                    leg,
                  ) =>
                    leg
                      .selectedAlternative
                      .label,
                )
                .join(
                  ' · ',
                )

            setStatus(
              `Percorso calcolato: ${sectionSummary}${ferryLegs ? ` · ${ferryLegs}` : ''}.`,
            )
          } else {
            setStatus(
              'Percorso calcolato.',
            )
          }

        } catch (error) {
          console.error(
            error,
          )

          if (
            !cancelled
          ) {
            removeRoute()

            setDistance(null)
            setDuration(null)

            setStatus(
              error instanceof Error
                ? error.message
                : 'Errore durante il calcolo del percorso.',
            )
          }
        }
      }

    calculateRoute()

    return () => {
      cancelled =
        true
    }
  }, [
    startPlace,
    destinationPlace,
    waypoints,
    pendingRoadPointSelection,
    pendingEndpointMapSelection,
    tripSettings
      .routeStyle,
    tripSettings
      .roadPreferences
      .allowFerries,
    tripSettings
      .roadPreferences
      .avoidUnpaved,
    tripSettings
      .roadPreferences
      .avoidMotorways,
    tripSettings
      .roadPreferences
      .avoidTolls,
    tripSettings
      .roadPreferences
      .avoidNarrowRoads,
    tripSettings
      .roadPreferences
      .avoidUrbanAreas,
  ])

  const renderAddButton =
    (
      index:
        number,
    ) => {
      if (
        draggedWaypointIndex !==
        null
      ) {
        const active =
          dragOverInsertIndex ===
          index

        return (
          <div
            className={
              active
                ? 'waypoint-drop-zone active'
                : 'waypoint-drop-zone'
            }
            onDragOver={(
              event,
            ) =>
              handleWaypointDragOver(
                event,
                index,
              )
            }
            onDrop={(
              event,
            ) =>
              handleWaypointDrop(
                event,
                index,
              )
            }
          >
            {active && (
              <span>
                Rilascia qui
              </span>
            )}
          </div>
        )
      }

      if (
        pendingRoadPointSelection
          ?.insertIndex ===
          index &&
        pendingRoadPointSelection
          .replaceIndex ===
          null
      ) {
        return (
          <div className="road-point-pending-inline">
            <span>
              📍 Clicca sulla mappa
            </span>

            <button
              type="button"
              onClick={
                cancelPendingRoadPoint
              }
            >
              Annulla
            </button>
          </div>
        )
      }

      const isEditing =
        editingInsertIndex ===
          index &&
        editingWaypoint

      if (isEditing) {
        return (
          <div className="waypoint-editor">
            <div className="waypoint-editor-title">
              Nuova tappa
            </div>

            <SearchField
              placeholder="Località, indirizzo o POI"
              value={
                editingWaypoint.query
              }
              results={
                editingWaypoint.results
              }
              loading={
                editingWaypoint.loading
              }
              onChange={(
                value,
              ) =>
                setEditingWaypoint({
                  ...editingWaypoint,

                  query:
                    value,

                  results:
                    [],
                })
              }
              onAutocomplete={
                autocompleteIntermediate
              }
              onSelect={
                selectIntermediateWaypoint
              }
            />

            <div className="waypoint-editor-secondary-actions">
              <button
                type="button"
                className="road-point-map-button"
                onClick={() =>
                  startDirectRoadPoint(
                    index,
                  )
                }
              >
                📍 Punto strada sulla mappa
              </button>

              <button
                type="button"
                className="cancel-waypoint"
                onClick={
                  closeWaypointEditor
                }
              >
                Annulla
              </button>
            </div>
          </div>
        )
      }

      return (
        <div className="insert-waypoint-row">
          <button
            type="button"
            onClick={() =>
              startInsertWaypoint(
                index,
              )
            }
          >
            + Inserisci tappa qui
          </button>
        </div>
      )
    }

  const renderWaypoint =
    (
      waypoint:
        Waypoint,

      index:
        number,
    ) => {
      if (
        editingExistingWaypointIndex ===
          index &&
        editingWaypoint
      ) {
        return (
          <div className="waypoint-editor">
            <div className="waypoint-editor-title">
              Modifica tappa
            </div>

            <SearchField
              placeholder="Località, indirizzo o POI"
              value={
                editingWaypoint.query
              }
              results={
                editingWaypoint.results
              }
              loading={
                editingWaypoint.loading
              }
              onChange={(
                value,
              ) =>
                setEditingWaypoint({
                  ...editingWaypoint,

                  query:
                    value,

                  results:
                    [],
                })
              }
              onAutocomplete={
                autocompleteIntermediate
              }
              onSelect={
                selectIntermediateWaypoint
              }
            />

            <button
              type="button"
              className="cancel-waypoint"
              onClick={
                closeWaypointEditor
              }
            >
              Annulla
            </button>
          </div>
        )
      }

      const menuKey =
        `waypoint-${waypoint.id}`

      const dragging =
        draggedWaypointIndex ===
        index

      return (
        <div
          className={[
            'compact-stop-row',
            'draggable-stop-row',

            pendingRoadPointWaypointId ===
            waypoint.id
              ? 'awaiting-road-point'
              : '',

            dragging
              ? 'is-dragging'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="waypoint-leading">
            <span
              className="waypoint-drag-handle"
              draggable
              title="Trascina per spostare la tappa"
              onDragStart={(event) =>
                handleWaypointDragStart(
                  event,
                  index,
                )
              }
              onDragEnd={
                handleWaypointDragEnd
              }
            >
              ⠿
            </span>

            <span className="compact-index">
              {index + 1}
            </span>
          </div>

          <span className="compact-place-name">
            {waypoint.name}
          </span>

          <div className="compact-role-wrap">
            <button
              type="button"
              className={`compact-role-button ${waypointRoleClass(
                waypoint.type,
              )}`}
              onClick={() =>
                setOpenMenuKey(
                  openMenuKey ===
                    menuKey
                    ? null
                    : menuKey,
                )
              }
            >
              {waypointRoleLabel(
                waypoint.type,
              )}

              <span>
                ▾
              </span>
            </button>

            {openMenuKey ===
              menuKey && (
              <div className="compact-menu">
                <button
                  type="button"
                  onClick={() =>
                    changeWaypointType(
                      index,
                      'precise-stop',
                    )
                  }
                >
                  <span>
                    Sosta
                  </span>

                  {waypoint.type ===
                    'precise-stop' && (
                    <strong>
                      ✓
                    </strong>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeWaypointType(
                      index,
                      'zone-pass',
                    )
                  }
                >
                  <span>
                    Passaggio
                  </span>

                  {waypoint.type ===
                    'zone-pass' && (
                    <strong>
                      ✓
                    </strong>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeWaypointType(
                      index,
                      'road-point',
                    )
                  }
                >
                  <span>
                    Punto strada
                  </span>

                  {waypoint.type ===
                    'road-point' && (
                    <strong>
                      ✓
                    </strong>
                  )}
                </button>

                <div className="compact-menu-separator" />

                <button
                  type="button"
                  onClick={() =>
                    startEditWaypoint(
                      index,
                    )
                  }
                >
                  Modifica località
                </button>

                <button
                  type="button"
                  disabled={
                    index === 0
                  }
                  onClick={() =>
                    moveWaypoint(
                      index,
                      -1,
                    )
                  }
                >
                  Sposta prima
                </button>

                <button
                  type="button"
                  disabled={
                    index ===
                    waypoints.length -
                      1
                  }
                  onClick={() =>
                    moveWaypoint(
                      index,
                      1,
                    )
                  }
                >
                  Sposta dopo
                </button>

                <div className="compact-menu-separator" />

                <button
                  type="button"
                  className="compact-delete-action"
                  onClick={() =>
                    removeWaypoint(
                      index,
                    )
                  }
                >
                  Elimina tappa
                </button>
              </div>
            )}
          </div>

          {pendingRoadPointWaypointId ===
            waypoint.id && (
            <div className="compact-road-hint">
              Clicca sulla mappa
            </div>
          )}
        </div>
      )
    }

  const renderStart =
    () => {
      if (
        !startPlace ||
        editingStart
      ) {
        return (
          <div className="endpoint-edit-card">
            <div className="endpoint-edit-title">
              <span className="compact-endpoint-badge start-badge">
                A
              </span>

              <strong>
                Partenza
              </strong>
            </div>

            <SearchField
              placeholder="Es. Milano"
              value={
                startQuery
              }
              results={
                startResults
              }
              loading={
                startLoading
              }
              onAutocomplete={
                autocompleteStart
              }
              onChange={(
                value,
              ) => {
                setStartQuery(
                  value,
                )

                setStartResults(
                  [],
                )
              }}
              onSelect={
                selectStart
              }
            />

            {pendingEndpointMapSelection ===
            'start' ? (
              <div className="road-point-pending-inline">
                <span>
                  📍 Clicca sulla mappa
                </span>

                <button
                  type="button"
                  onClick={
                    cancelEndpointMapSelection
                  }
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="road-point-map-button"
                onClick={() =>
                  startEndpointMapSelection(
                    'start',
                  )
                }
              >
                📍 Scegli sulla mappa
              </button>
            )}

            {startPlace && (
              <button
                type="button"
                className="cancel-waypoint"
                onClick={() => {
                  setStartQuery(
                    startPlace.name,
                  )

                  setStartResults(
                    [],
                  )

                  setEditingStart(
                    false,
                  )
                }}
              >
                Annulla
              </button>
            )}
          </div>
        )
      }

      return (
        <div className="compact-stop-row">
          <span className="compact-endpoint-badge start-badge">
            A
          </span>

          <span className="compact-place-name">
            {startPlace.name}
          </span>

          <div className="compact-role-wrap">
            <button
              type="button"
              className="compact-role-button role-start"
              onClick={() =>
                setOpenMenuKey(
                  openMenuKey ===
                    'start'
                    ? null
                    : 'start',
                )
              }
            >
              Partenza

              <span>
                ▾
              </span>
            </button>

            {openMenuKey ===
              'start' && (
              <div className="compact-menu">
                <button
                  type="button"
                  onClick={() => {
                    setStartQuery(
                      startPlace.name,
                    )

                    setStartResults(
                      [],
                    )

                    setEditingStart(
                      true,
                    )

                    setOpenMenuKey(
                      null,
                    )
                  }}
                >
                  Modifica località
                </button>

                <button
                  type="button"
                  onClick={() =>
                    startEndpointMapSelection(
                      'start',
                    )
                  }
                >
                  Sposta sulla mappa
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

  const renderDestination =
    () => {
      if (
        !destinationPlace ||
        editingDestination
      ) {
        return (
          <div className="endpoint-edit-card">
            <div className="endpoint-edit-title">
              <span className="compact-endpoint-badge destination-badge">
                B
              </span>

              <strong>
                Arrivo
              </strong>
            </div>

            <SearchField
              placeholder="Es. Firenze"
              value={
                destinationQuery
              }
              results={
                destinationResults
              }
              loading={
                destinationLoading
              }
              onAutocomplete={
                autocompleteDestination
              }
              onChange={(
                value,
              ) => {
                setDestinationQuery(
                  value,
                )

                setDestinationResults(
                  [],
                )
              }}
              onSelect={
                selectDestination
              }
            />

            {pendingEndpointMapSelection ===
            'destination' ? (
              <div className="road-point-pending-inline">
                <span>
                  📍 Clicca sulla mappa
                </span>

                <button
                  type="button"
                  onClick={
                    cancelEndpointMapSelection
                  }
                >
                  Annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="road-point-map-button"
                onClick={() =>
                  startEndpointMapSelection(
                    'destination',
                  )
                }
              >
                📍 Scegli sulla mappa
              </button>
            )}

            {destinationPlace && (
              <button
                type="button"
                className="cancel-waypoint"
                onClick={() => {
                  setDestinationQuery(
                    destinationPlace.name,
                  )

                  setDestinationResults(
                    [],
                  )

                  setEditingDestination(
                    false,
                  )
                }}
              >
                Annulla
              </button>
            )}
          </div>
        )
      }

      return (
        <div className="compact-stop-row">
          <span className="compact-endpoint-badge destination-badge">
            B
          </span>

          <span className="compact-place-name">
            {destinationPlace.name}
          </span>

          <div className="compact-role-wrap">
            <button
              type="button"
              className="compact-role-button role-destination"
              onClick={() =>
                setOpenMenuKey(
                  openMenuKey ===
                    'destination'
                    ? null
                    : 'destination',
                )
              }
            >
              Arrivo

              <span>
                ▾
              </span>
            </button>

            {openMenuKey ===
              'destination' && (
              <div className="compact-menu">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationQuery(
                      destinationPlace.name,
                    )

                    setDestinationResults(
                      [],
                    )

                    setEditingDestination(
                      true,
                    )

                    setOpenMenuKey(
                      null,
                    )
                  }}
                >
                  Modifica località
                </button>

                <button
                  type="button"
                  onClick={() =>
                    startEndpointMapSelection(
                      'destination',
                    )
                  }
                >
                  Sposta sulla mappa
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

  const editingDay =
    editingDayId
      ? days.find(
          (day) =>
            day.id ===
            editingDayId,
        )
      : undefined

  const renderItinerary =
    () => (
      <section className="sidebar-section">
        <h2>
          Itinerario & Tappe
        </h2>

        {editingDay && (
          <div className="day-route-editor-banner">
            <div>
              <strong>
                Giorno {editingDay.dayNumber} · {editingDay.dateLabel}
              </strong>

              <span>
                Modifica il percorso con partenza, arrivo e solo i punti di passaggio realmente necessari.
              </span>
            </div>

            <div className="day-route-editor-actions">
              <button
                type="button"
                onClick={
                  handleCancelDayRouteEdit
                }
              >
                Annulla
              </button>

              <button
                type="button"
                className="day-route-editor-apply"
                onClick={
                  handleApplyDayRoute
                }
              >
                Applica al giorno
              </button>
            </div>
          </div>
        )}

        <div className="compact-itinerary">
          {renderStart()}

          {renderAddButton(
            0,
          )}

          {waypoints.map(
            (
              waypoint,
              index,
            ) => (
              <div
                key={
                  waypoint.id
                }
              >
                {renderWaypoint(
                  waypoint,
                  index,
                )}

                {renderAddButton(
                  index + 1,
                )}
              </div>
            ),
          )}

          {renderDestination()}
        </div>

        <p className="route-status">
          {status}
        </p>
      </section>
    )

  const renderSidebarContent =
    () => {
      if (
        activeSection ===
        'fuel'
      ) {
        return (
          <section className="sidebar-section">
            <h2>
              Rifornimenti
            </h2>

            <div className="placeholder-card">
              <strong>
                Pianificazione carburante
              </strong>

              <p>
                Qui inseriremo autonomia moto,
                distributori sul percorso e
                deviazione massima consentita.
              </p>

              <span>
                Funzione in preparazione
              </span>
            </div>
          </section>
        )
      }

      if (
        activeSection ===
        'breaks'
      ) {
        return (
          <section className="sidebar-section">
            <h2>
              Pause & Pranzo
            </h2>

            <div className="placeholder-card">
              <strong>
                Pause di viaggio
              </strong>

              <p>
                Qui gestiremo frequenza delle
                pause, pranzo e soste di comfort.
              </p>

              <span>
                Funzione in preparazione
              </span>
            </div>
          </section>
        )
      }

      if (
        activeSection ===
        'days'
      ) {
        return (
          <section className="sidebar-section">
            <h2>
              Giornate & Hotel
            </h2>

            <DaysHotelPanel
              days={days}
              selectedDayId={selectedDayId}
              routeStats={dayRouteStats}
              routingBusy={daysRoutingBusy}
              routingProgress={daysRoutingProgress}
              routePlan={currentRoutePlan}
              startPlace={startPlace}
              destinationPlace={destinationPlace}
              masterWaypoints={waypoints}
              settings={tripSettings}
              onChange={handleDaysChange}
              onDatesChange={(
                departureDate,
                returnDate,
              ) => {
                const plannedDays =
                  tripDaysBetween(
                    departureDate,
                    returnDate,
                  )

                setTripSettings(
                  (
                    current,
                  ) => ({
                    ...current,

                    departureDate,
                    returnDate,

                    durationMode:
                      plannedDays ===
                        1
                        ? 'single-day'
                        : plannedDays
                          ? 'multi-day'
                          : current
                              .durationMode,

                    plannedDays:
                      plannedDays ??
                      current
                        .plannedDays,
                  }),
                )
              }}
              onOvernightPlaceChange={(
                dayId,
                place,
              ) => {
                applyOvernightPlace(
                  dayId,
                  place,
                )

                overnightMarkersRef
                  .current
                  .get(
                    dayId,
                  )
                  ?.setLngLat([
                    place.lng,
                    place.lat,
                  ])

                setStatus(
                  'Punto pernottamento aggiornato. Premi Salva per conservarlo.',
                )
              }}
              onSelectDay={handleSelectDayRoute}
              onShowOverview={handleShowTripOverview}
              onStatus={setStatus}
            />

            <p className="route-status">
              {status}
            </p>
          </section>
        )
      }

      return renderItinerary()
    }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark">
            M
          </div>

          <div>
            <strong>
              Moto Trip Planner
            </strong>

            <span>
              Pianifica qui. Naviga con ciò che preferisci.
            </span>
          </div>
        </div>

        <div className="trip-summary">
          <input
            className="trip-name-input"
            type="text"
            value={
              tripName
            }
            maxLength={60}
            onChange={(
              event,
            ) =>
              setTripName(
                event.target.value,
              )
            }
          />

          <span>
            {distance !== null
              ? formatDistance(
                  distance,
                )
              : '— km'}
          </span>

          <span>
            {duration !== null
              ? formatDuration(
                  duration,
                )
              : '— guida'}
          </span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() =>
              setTripSettingsOpen(
                true,
              )
            }
          >
            Impostazioni
          </button>

          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              refreshSavedTrips()

              setTripsModalOpen(
                true,
              )
            }}
          >
            I miei Viaggi
          </button>

          <button
            type="button"
            className="save-action"
            onClick={
              handleSaveTrip
            }
          >
            Salva
          </button>

          <button
            type="button"
            className="secondary-action"
            onClick={
              resetTrip
            }
          >
            + Nuovo
          </button>
        </div>
      </header>

      <nav className="section-tabs">
        <button
          type="button"
          className={
            activeSection ===
            'itinerary'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection(
              'itinerary',
            )
          }
        >
          Itinerario & Tappe
        </button>

        <button
          type="button"
          className={
            activeSection ===
            'fuel'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection(
              'fuel',
            )
          }
        >
          Rifornimenti
        </button>

        <button
          type="button"
          className={
            activeSection ===
            'breaks'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection(
              'breaks',
            )
          }
        >
          Pause & Pranzo
        </button>

        <button
          type="button"
          className={
            activeSection ===
            'days'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection(
              'days',
            )
          }
        >
          Giornate & Hotel
        </button>
      </nav>

      <div className="workspace">
        <aside className="sidebar">
          {renderSidebarContent()}
        </aside>

        <main className="map-area">
          <div
            ref={
              mapContainerRef
            }
            className="map"
          />
        </main>
      </div>

      <TripsModal
        open={
          tripsModalOpen
        }
        trips={
          savedTrips
        }
        currentTripId={
          currentTripId
        }
        onClose={() =>
          setTripsModalOpen(
            false,
          )
        }
        onLoad={
          loadTrip
        }
        onDuplicate={
          handleDuplicateTrip
        }
        onDelete={
          handleDeleteTrip
        }
      />

      <TripSettingsModal
        open={
          tripSettingsOpen
        }
        settings={
          tripSettings
        }
        onClose={() =>
          setTripSettingsOpen(
            false,
          )
        }
        onApply={(
          settings,
        ) => {
          setTripSettings(
            cloneTripSettings(
              settings,
            ),
          )

          setStatus(
            'Impostazioni viaggio aggiornate. Premi Salva per memorizzarle nel viaggio.',
          )
        }}
      />

      {pendingAreaSelection && (
        <div className="area-choice-backdrop">
          <div className="area-choice-dialog">
            <h3>
              Località, non punto preciso
            </h3>

            <p>
              Hai selezionato
              <strong>
                {' '}
                {pendingAreaSelection.result.name}
              </strong>
              .
            </p>

            <p>
              Come vuoi utilizzarla?
            </p>

            <div className="area-choice-actions">
              <button
                type="button"
                className="zone-choice"
                onClick={
                  confirmAreaAsZone
                }
              >
                Passaggio
              </button>

              <button
                type="button"
                className="center-choice"
                onClick={
                  confirmAreaAsCenter
                }
              >
                Sosta al centro
              </button>

              <button
                type="button"
                onClick={() =>
                  setPendingAreaSelection(
                    null,
                  )
                }
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App