import {
  useEffect,
  useRef,
  useState,
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

import { mapProvider } from './config/mapProvider'

import {
  osrmRoutingProvider,
  type RoutePoint,
} from './providers/routingProvider'

import {
  nominatimGeocodingProvider,
  type GeocodingResult,
} from './providers/geocodingProvider'

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
  type Waypoint,
  type WaypointType,
} from './types/waypoint'

import { TripsModal } from './components/TripsModal'

setWorkerUrl(workerUrl)

type ActiveSection =
  | 'itinerary'
  | 'fuel'
  | 'breaks'
  | 'days'

type EditingWaypoint = {
  id: string
  query: string
  results: GeocodingResult[]
  loading: boolean
}

type PendingAreaSelection = {
  result: GeocodingResult
  waypointId: string
  insertIndex: number | null
  replaceIndex: number | null
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
    | 'destination',
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
  results: GeocodingResult[]
  loading: boolean
  onChange: (
    value: string,
  ) => void
  onSearch: () => void
  onSelect: (
    result: GeocodingResult,
  ) => void
}

function SearchField({
  label,
  placeholder,
  value,
  results,
  loading,
  onChange,
  onSearch,
  onSelect,
}: SearchFieldProps) {
  return (
    <div className="search-field">
      {label && (
        <label>
          {label}
        </label>
      )}

      <div className="search-controls">
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
              event.key ===
              'Enter'
            ) {
              event.preventDefault()
              onSearch()
            }
          }}
        />

        <button
          type="button"
          className="search-button"
          disabled={loading}
          onClick={onSearch}
        >
          {loading
            ? '...'
            : 'Cerca'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          {results.map(
            (result) => (
              <button
                key={result.id}
                type="button"
                className="search-result"
                onClick={() =>
                  onSelect(
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

                {(result.type ||
                  result.category) && (
                    <small>
                      {result.type ??
                        ''}

                      {result.type &&
                      result.category
                        ? ' · '
                        : ''}

                      {result.category ??
                        ''}
                    </small>
                  )}
              </button>
            ),
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
      GeocodingResult[]
    >([])

  const [
    destinationResults,
    setDestinationResults,
  ] =
    useState<
      GeocodingResult[]
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
    pendingRoadPointWaypointId,
    setPendingRoadPointWaypointId,
  ] =
    useState<string | null>(
      null,
    )

  const [
    openMenuKey,
    setOpenMenuKey,
  ] =
    useState<string | null>(
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
                  String(index + 1),
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

  const clearRouteData =
    () => {
      removeRoute()

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
      removeRoute()

      setTripName(
        'Nuovo viaggio',
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

      closeWaypointEditor()

      setPendingAreaSelection(
        null,
      )

      setPendingRoadPointWaypointId(
        null,
      )

      setOpenMenuKey(
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
        !startPlace ||
        !destinationPlace
      ) {
        setStatus(
          'Imposta partenza e destinazione prima di salvare.',
        )

        return
      }

      if (
        pendingRoadPointWaypointId
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

      setPendingRoadPointWaypointId(
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
        'itinerary',
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

  const searchStart =
    async () => {
      const query =
        startQuery.trim()

      if (
        query.length < 3
      ) {
        setStatus(
          'Inserisci almeno 3 caratteri per la partenza.',
        )

        return
      }

      try {
        setStartLoading(
          true,
        )

        setStartResults([])

        const results =
          await nominatimGeocodingProvider
            .search(query)

        setStartResults(
          results,
        )

        setStatus(
          results.length
            ? `${results.length} risultati trovati.`
            : `Nessun risultato trovato per "${query}".`,
        )
      } catch (error) {
        console.error(
          error,
        )

        setStatus(
          error instanceof
            Error
            ? error.message
            : 'Errore durante la ricerca della partenza.',
        )
      } finally {
        setStartLoading(
          false,
        )
      }
    }

  const searchDestination =
    async () => {
      const query =
        destinationQuery
          .trim()

      if (
        query.length < 3
      ) {
        setStatus(
          'Inserisci almeno 3 caratteri per la destinazione.',
        )

        return
      }

      try {
        setDestinationLoading(
          true,
        )

        setDestinationResults(
          [],
        )

        const results =
          await nominatimGeocodingProvider
            .search(query)

        setDestinationResults(
          results,
        )

        setStatus(
          results.length
            ? `${results.length} risultati trovati.`
            : `Nessun risultato trovato per "${query}".`,
        )
      } catch (error) {
        console.error(
          error,
        )

        setStatus(
          error instanceof
            Error
            ? error.message
            : 'Errore durante la ricerca della destinazione.',
        )
      } finally {
        setDestinationLoading(
          false,
        )
      }
    }

  const searchIntermediate =
    async () => {
      if (
        !editingWaypoint
      ) {
        return
      }

      const query =
        editingWaypoint
          .query
          .trim()

      if (
        query.length < 3
      ) {
        setStatus(
          'Inserisci almeno 3 caratteri per la tappa.',
        )

        return
      }

      setEditingWaypoint({
        ...editingWaypoint,

        loading:
          true,

        results:
          [],
      })

      try {
        const results =
          await nominatimGeocodingProvider
            .search(query)

        setEditingWaypoint({
          ...editingWaypoint,

          loading:
            false,

          results,
        })

        setStatus(
          results.length
            ? `${results.length} risultati trovati.`
            : `Nessun risultato trovato per "${query}".`,
        )
      } catch (error) {
        console.error(
          error,
        )

        setEditingWaypoint({
          ...editingWaypoint,

          loading:
            false,

          results:
            [],
        })

        setStatus(
          error instanceof
            Error
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
            color:
              '#dc2626',
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
        setPendingRoadPointWaypointId(
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
          'zone-pass' &&
        !waypoint.boundingBox
      ) {
        setStatus(
          'Questa tappa non dispone di un’area geografica utilizzabile come Passaggio zona.',
        )

        setOpenMenuKey(
          null,
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

      if (
        type ===
        'road-point'
      ) {
        setPendingRoadPointWaypointId(
          waypoint.id,
        )

        removeRoute()

        setDistance(null)
        setDuration(null)

        setStatus(
          'Punto strada: clicca sulla mappa nel punto desiderato.',
        )

        return
      }

      if (
        pendingRoadPointWaypointId ===
        waypoint.id
      ) {
        setPendingRoadPointWaypointId(
          null,
        )
      }

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
      !pendingRoadPointWaypointId
    ) {
      return
    }

    const waypointIndex =
      waypoints.findIndex(
        (waypoint) =>
          waypoint.id ===
          pendingRoadPointWaypointId,
      )

    if (
      waypointIndex < 0
    ) {
      return
    }

    let previous:
      RoutePoint | undefined

    let next:
      RoutePoint | undefined

    if (
      waypointIndex === 0
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
            waypointIndex - 1
          ],
        )
    }

    if (
      waypointIndex ===
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
            waypointIndex + 1
          ],
        )
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
            'Cerco la strada più adatta vicino al punto selezionato...',
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

          setWaypoints(
            (current) => {
              const updated =
                current.map(
                  (waypoint) =>
                    waypoint.id ===
                    pendingRoadPointWaypointId
                      ? {
                          ...waypoint,

                          type:
                            'road-point' as const,

                          name:
                            'Punto strada',

                          label:
                            `${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`,

                          lat:
                            resolved.lat,

                          lng:
                            resolved.lng,

                          boundingBox:
                            undefined,
                        }
                      : waypoint,
                )

              syncWaypointMarkers(
                updated,
              )

              return updated
            },
          )

          setPendingRoadPointWaypointId(
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
            error instanceof
              Error
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
    pendingRoadPointWaypointId,
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
      pendingRoadPointWaypointId
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

          const route =
            await osrmRoutingProvider
              .calculateRoute(
                points,
              )

          if (cancelled) {
            return
          }

          removeRoute()

          map.addSource(
            'route',
            {
              type:
                'geojson',

              data: {
                type:
                  'Feature',

                properties:
                  {},

                geometry:
                  route.geometry,
              },
            },
          )

          map.addLayer({
            id:
              'route',

            type:
              'line',

            source:
              'route',

            layout: {
              'line-join':
                'round',

              'line-cap':
                'round',
            },

            paint: {
              'line-width':
                5,

              'line-color':
                '#2563eb',
            },
          })

          const coordinates =
            route.geometry
              .coordinates

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

          setDistance(
            route.distanceMeters,
          )

          setDuration(
            route.durationSeconds,
          )

          setStatus(
            'Percorso calcolato.',
          )
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
              error instanceof
                Error
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
    pendingRoadPointWaypointId,
  ])

  const renderAddButton =
    (
      index:
        number,
    ) => {
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
              onSearch={
                searchIntermediate
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
              onSearch={
                searchIntermediate
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

      return (
        <div
          className={
            pendingRoadPointWaypointId ===
            waypoint.id
              ? 'compact-stop-row awaiting-road-point'
              : 'compact-stop-row'
          }
        >
          <span className="compact-index">
            {index + 1}
          </span>

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
              placeholder="Es. Viganò"
              value={
                startQuery
              }
              results={
                startResults
              }
              loading={
                startLoading
              }
              onSearch={
                searchStart
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
              placeholder="Es. Lecco"
              value={
                destinationQuery
              }
              results={
                destinationResults
              }
              loading={
                destinationLoading
              }
              onSearch={
                searchDestination
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
              </div>
            )}
          </div>
        </div>
      )
    }

  const renderItinerary =
    () => (
      <section className="sidebar-section">
        <h2>
          Itinerario & Tappe
        </h2>

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

            <div className="placeholder-card">
              <strong>
                Viaggio multi-giorno
              </strong>

              <p>
                Qui divideremo il tour in giornate,
                pernottamenti e timeline.
              </p>

              <span>
                Funzione in preparazione
              </span>
            </div>
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