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
  insertIndex: number
  waypointId: string
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
          let color =
            '#7c3aed'

          if (
            waypoint.type ===
            'zone-pass'
          ) {
            color =
              '#f59e0b'
          }

          if (
            waypoint.type ===
            'road-point'
          ) {
            color =
              '#0891b2'
          }

          const marker =
            new Marker({
              color,
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

      setWaypoints([])

      setEditingWaypoint(
        null,
      )

      setEditingInsertIndex(
        null,
      )

      setPendingAreaSelection(
        null,
      )

      setPendingRoadPointWaypointId(
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

      setWaypoints(
        trip.waypoints ?? [],
      )

      setStartQuery(
        trip.startPlace
          ?.label ?? '',
      )

      setDestinationQuery(
        trip.destinationPlace
          ?.label ?? '',
      )

      setStartResults([])
      setDestinationResults([])

      setDistance(
        trip.distance,
      )

      setDuration(
        trip.duration,
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
            color:
              '#16a34a',
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
            color:
              '#dc2626',
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
            ? `${results.length} risultati trovati. Scegli la partenza corretta.`
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
            ? `${results.length} risultati trovati. Scegli la destinazione corretta.`
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
            ? `${results.length} risultati trovati. Scegli la tappa corretta.`
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
        result.label,
      )

      setStartResults([])

      startMarkerRef
        .current
        ?.remove()

      if (map) {
        startMarkerRef.current =
          new Marker({
            color:
              '#16a34a',
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
        result.label,
      )

      setDestinationResults(
        [],
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
    }

  const cancelInsertWaypoint =
    () => {
      setEditingInsertIndex(
        null,
      )

      setEditingWaypoint(
        null,
      )
    }

  const insertWaypoint =
    (
      waypoint:
        Waypoint,

      index:
        number,
    ) => {
      const updated =
        [...waypoints]

      updated.splice(
        index,
        0,
        waypoint,
      )

      setWaypoints(
        updated,
      )

      syncWaypointMarkers(
        updated,
      )

      setEditingInsertIndex(
        null,
      )

      setEditingWaypoint(
        null,
      )

      clearRouteData()
    }

  const selectIntermediateWaypoint =
    (
      result:
        GeocodingResult,
    ) => {
      if (
        editingInsertIndex ===
        null ||
        !editingWaypoint
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

          insertIndex:
            editingInsertIndex,

          waypointId:
            editingWaypoint.id,
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

      insertWaypoint(
        waypoint,
        editingInsertIndex,
      )

      setStatus(
        `Sosta precisa "${waypoint.name}" inserita.`,
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
        insertIndex,
        waypointId,
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

      insertWaypoint(
        waypoint,
        insertIndex,
      )

      setPendingAreaSelection(
        null,
      )

      setStatus(
        `"${waypoint.name}" inserito come Passaggio zona.`,
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
        insertIndex,
        waypointId,
      } =
        pendingAreaSelection

      const waypoint:
        Waypoint = {
          id:
            waypointId,

          type:
            'precise-stop',

          name:
            `${result.name} - centro`,

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

      insertWaypoint(
        waypoint,
        insertIndex,
      )

      setPendingAreaSelection(
        null,
      )

      setStatus(
        `Centro di "${result.name}" inserito come Sosta precisa.`,
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
          `"${waypoint.name}" impostato come Passaggio zona.`,
        )
      }

      if (
        type ===
        'precise-stop'
      ) {
        setStatus(
          `"${waypoint.name}" impostato come Sosta precisa.`,
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
            'Punto strada impostato sulla strada più adatta.',
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

              /*
               * null significa che il percorso
               * migliore attraversa già la zona.
               * Non aggiungiamo quindi alcun
               * punto artificiale.
               */

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
        index

      if (
        isEditing &&
        editingWaypoint
      ) {
        return (
          <div className="waypoint-editor">
            <div className="waypoint-editor-title">
              Nuova tappa intermedia
            </div>

            <SearchField
              label="Località / indirizzo / POI"
              placeholder="Es. Lecco, Passo dello Stelvio..."
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
                cancelInsertWaypoint
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
            + Inserisci tappa intermedia qui
          </button>
        </div>
      )
    }

  const renderItinerary =
    () => (
      <>
        <section className="sidebar-section">
          <h2>
            Itinerario & Tappe
          </h2>

          <div className="endpoint-card start-endpoint">
            <div className="endpoint-title">
              <span className="endpoint-badge">
                A
              </span>

              <strong>
                Partenza
              </strong>
            </div>

            <SearchField
              placeholder="Es. Viganò, Lecco"
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

                if (
                  startPlace
                ) {
                  startMarkerRef
                    .current
                    ?.remove()

                  startMarkerRef.current =
                    null

                  setStartPlace(
                    null,
                  )

                  clearRouteData()
                }

                setStartResults(
                  [],
                )
              }}
              onSelect={
                selectStart
              }
            />
          </div>

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
                <div
                  className={
                    pendingRoadPointWaypointId ===
                    waypoint.id
                      ? 'waypoint-card awaiting-road-point'
                      : 'waypoint-card'
                  }
                >
                  <div className="waypoint-card-main">
                    <span className="waypoint-number">
                      {index + 1}
                    </span>

                    <div className="waypoint-info">
                      <strong>
                        {waypoint.name}
                      </strong>

                      <small>
                        {waypoint.label}
                      </small>
                    </div>
                  </div>

                  <div className="waypoint-card-controls">
                    <select
                      value={
                        waypoint.type
                      }
                      onChange={(
                        event,
                      ) =>
                        changeWaypointType(
                          index,

                          event
                            .target
                            .value as WaypointType,
                        )
                      }
                    >
                      <option value="precise-stop">
                        Sosta precisa
                      </option>

                      <option value="zone-pass">
                        Passaggio zona
                      </option>

                      <option value="road-point">
                        Punto strada
                      </option>
                    </select>

                    <button
                      type="button"
                      disabled={
                        index ===
                        0
                      }
                      onClick={() =>
                        moveWaypoint(
                          index,
                          -1,
                        )
                      }
                      title="Sposta prima"
                    >
                      ↑
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
                      title="Sposta dopo"
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      className="waypoint-delete"
                      onClick={() =>
                        removeWaypoint(
                          index,
                        )
                      }
                      title="Elimina"
                    >
                      ×
                    </button>
                  </div>

                  {pendingRoadPointWaypointId ===
                    waypoint.id && (
                    <div className="road-point-hint">
                      Clicca sulla mappa per scegliere il Punto strada.
                    </div>
                  )}
                </div>

                {renderAddButton(
                  index + 1,
                )}
              </div>
            ),
          )}

          <div className="endpoint-card destination-endpoint">
            <div className="endpoint-title">
              <span className="endpoint-badge">
                B
              </span>

              <strong>
                Destinazione
              </strong>
            </div>

            <SearchField
              placeholder="Es. Bolzano"
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

                if (
                  destinationPlace
                ) {
                  destinationMarkerRef
                    .current
                    ?.remove()

                  destinationMarkerRef.current =
                    null

                  setDestinationPlace(
                    null,
                  )

                  clearRouteData()
                }

                setDestinationResults(
                  [],
                )
              }}
              onSelect={
                selectDestination
              }
            />
          </div>

          <p className="route-status">
            {status}
          </p>

          {distance !== null &&
            duration !== null && (
              <div className="route-summary">
                <div>
                  <span>
                    Distanza
                  </span>

                  <strong>
                    {formatDistance(
                      distance,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Guida stimata
                  </span>

                  <strong>
                    {formatDuration(
                      duration,
                    )}
                  </strong>
                </div>
              </div>
            )}
        </section>

        <section className="sidebar-section">
          <h2>
            Routing
          </h2>

          <p>
            Provider prototipo: OSRM
          </p>

          <p>
            Profilo attuale: Veloce / driving
          </p>
        </section>
      </>
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
              , che rappresenta una località o un'area geografica.
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
                Passaggio zona
              </button>

              <button
                type="button"
                className="center-choice"
                onClick={
                  confirmAreaAsCenter
                }
              >
                Centro città
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