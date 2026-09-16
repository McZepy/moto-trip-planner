import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  LngLatBounds,
  Map,
  Marker,
  NavigationControl,
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

setWorkerUrl(workerUrl)

type ActiveSection =
  | 'itinerary'
  | 'fuel'
  | 'breaks'
  | 'days'

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours} h ${minutes} min`
}

type SearchFieldProps = {
  label: string
  placeholder: string
  value: string
  results: GeocodingResult[]
  loading: boolean
  onChange: (value: string) => void
  onSearch: () => void
  onSelect: (result: GeocodingResult) => void
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
      <label>{label}</label>

      <div className="search-controls">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) =>
            onChange(event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
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
          {loading ? '...' : 'Cerca'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="search-results">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="search-result"
              onClick={() => onSelect(result)}
            >
              <strong>{result.name}</strong>

              <span>{result.label}</span>

              {(result.type ||
                result.category) && (
                <small>
                  {result.type ?? ''}
                  {result.type &&
                  result.category
                    ? ' · '
                    : ''}
                  {result.category ?? ''}
                </small>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function App() {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(null)

  const mapRef =
    useRef<Map | null>(null)

  const startMarkerRef =
    useRef<Marker | null>(null)

  const destinationMarkerRef =
    useRef<Marker | null>(null)

  const [activeSection, setActiveSection] =
    useState<ActiveSection>('itinerary')

  const [startQuery, setStartQuery] =
    useState('')

  const [
    destinationQuery,
    setDestinationQuery,
  ] = useState('')

  const [startResults, setStartResults] =
    useState<GeocodingResult[]>([])

  const [
    destinationResults,
    setDestinationResults,
  ] = useState<GeocodingResult[]>([])

  const [startLoading, setStartLoading] =
    useState(false)

  const [
    destinationLoading,
    setDestinationLoading,
  ] = useState(false)

  const [startPlace, setStartPlace] =
    useState<GeocodingResult | null>(null)

  const [
    destinationPlace,
    setDestinationPlace,
  ] = useState<GeocodingResult | null>(
    null,
  )

  const [distance, setDistance] =
    useState<number | null>(null)

  const [duration, setDuration] =
    useState<number | null>(null)

  const [status, setStatus] = useState(
    'Inserisci partenza e destinazione.',
  )

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    const map = new Map({
      container: mapContainerRef.current,
      style: mapProvider.styleUrl,
      center: [12.5, 42.5],
      zoom: 5.5,
    })

    map.addControl(
      new NavigationControl(),
      'top-right',
    )

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const removeRoute = () => {
    const map = mapRef.current

    if (!map) {
      return
    }

    if (map.getLayer('route')) {
      map.removeLayer('route')
    }

    if (map.getSource('route')) {
      map.removeSource('route')
    }
  }

  const clearRouteData = () => {
    removeRoute()
    setDistance(null)
    setDuration(null)
  }

  const resetTrip = () => {
    startMarkerRef.current?.remove()
    destinationMarkerRef.current?.remove()

    startMarkerRef.current = null
    destinationMarkerRef.current = null

    removeRoute()

    setStartQuery('')
    setDestinationQuery('')

    setStartResults([])
    setDestinationResults([])

    setStartPlace(null)
    setDestinationPlace(null)

    setDistance(null)
    setDuration(null)

    setStatus(
      'Inserisci partenza e destinazione.',
    )

    setActiveSection('itinerary')

    mapRef.current?.flyTo({
      center: [12.5, 42.5],
      zoom: 5.5,
    })
  }

  const searchStart = async () => {
    const query = startQuery.trim()

    if (query.length < 3) {
      setStatus(
        'Inserisci almeno 3 caratteri per la partenza.',
      )
      return
    }

    try {
      setStartLoading(true)
      setStartResults([])

      setStatus(
        `Ricerca partenza: "${query}"...`,
      )

      const results =
        await nominatimGeocodingProvider.search(
          query,
        )

      setStartResults(results)

      if (results.length === 0) {
        setStatus(
          `Nessun risultato trovato per "${query}".`,
        )
      } else {
        setStatus(
          `${results.length} risultati trovati. Scegli la partenza corretta.`,
        )
      }
    } catch (error) {
      console.error(error)

      setStartResults([])

      setStatus(
        error instanceof Error
          ? error.message
          : 'Errore durante la ricerca della partenza.',
      )
    } finally {
      setStartLoading(false)
    }
  }

  const searchDestination = async () => {
    const query =
      destinationQuery.trim()

    if (query.length < 3) {
      setStatus(
        'Inserisci almeno 3 caratteri per la destinazione.',
      )
      return
    }

    try {
      setDestinationLoading(true)
      setDestinationResults([])

      setStatus(
        `Ricerca destinazione: "${query}"...`,
      )

      const results =
        await nominatimGeocodingProvider.search(
          query,
        )

      setDestinationResults(results)

      if (results.length === 0) {
        setStatus(
          `Nessun risultato trovato per "${query}".`,
        )
      } else {
        setStatus(
          `${results.length} risultati trovati. Scegli la destinazione corretta.`,
        )
      }
    } catch (error) {
      console.error(error)

      setDestinationResults([])

      setStatus(
        error instanceof Error
          ? error.message
          : 'Errore durante la ricerca della destinazione.',
      )
    } finally {
      setDestinationLoading(false)
    }
  }

  const selectStart = (
    result: GeocodingResult,
  ) => {
    const map = mapRef.current

    clearRouteData()

    setStartPlace(result)
    setStartQuery(result.label)
    setStartResults([])

    startMarkerRef.current?.remove()

    if (map) {
      startMarkerRef.current =
        new Marker({
          color: '#16a34a',
        })
          .setLngLat([
            result.lng,
            result.lat,
          ])
          .addTo(map)

      map.flyTo({
        center: [
          result.lng,
          result.lat,
        ],
        zoom: 11,
      })
    }

    setStatus(
      'Partenza impostata. Inserisci la destinazione.',
    )
  }

  const selectDestination = (
    result: GeocodingResult,
  ) => {
    const map = mapRef.current

    clearRouteData()

    setDestinationPlace(result)
    setDestinationQuery(result.label)
    setDestinationResults([])

    destinationMarkerRef.current?.remove()

    if (map) {
      destinationMarkerRef.current =
        new Marker({
          color: '#dc2626',
        })
          .setLngLat([
            result.lng,
            result.lat,
          ])
          .addTo(map)
    }

    setStatus(
      'Destinazione impostata. Calcolo percorso...',
    )
  }

  useEffect(() => {
    const map = mapRef.current

    if (
      !map ||
      !startPlace ||
      !destinationPlace
    ) {
      return
    }

    let cancelled = false

    const calculateRoute = async () => {
      setStatus('Calcolo percorso...')

      const start: RoutePoint = {
        lat: startPlace.lat,
        lng: startPlace.lng,
      }

      const destination: RoutePoint = {
        lat: destinationPlace.lat,
        lng: destinationPlace.lng,
      }

      try {
        const route =
          await osrmRoutingProvider.calculateRoute(
            start,
            destination,
          )

        if (cancelled) {
          return
        }

        removeRoute()

        map.addSource('route', {
          type: 'geojson',

          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          },
        })

        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',

          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },

          paint: {
            'line-width': 5,
            'line-color': '#2563eb',
          },
        })

        const coordinates =
          route.geometry.coordinates

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

        map.fitBounds(bounds, {
          padding: 70,
        })

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
        console.error(error)

        if (!cancelled) {
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
      cancelled = true
    }
  }, [
    startPlace,
    destinationPlace,
  ])

  const renderSidebarContent = () => {
    if (activeSection === 'fuel') {
      return (
        <section className="sidebar-section">
          <h2>Rifornimenti</h2>

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

    if (activeSection === 'breaks') {
      return (
        <section className="sidebar-section">
          <h2>Pause & Pranzo</h2>

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

    if (activeSection === 'days') {
      return (
        <section className="sidebar-section">
          <h2>Giornate & Hotel</h2>

          <div className="placeholder-card">
            <strong>
              Viaggio multi-giorno
            </strong>

            <p>
              Qui divideremo il tour in
              giornate, pernottamenti e
              timeline.
            </p>

            <span>
              Funzione in preparazione
            </span>
          </div>
        </section>
      )
    }

    return (
      <>
        <section className="sidebar-section">
          <h2>Itinerario & Tappe</h2>

          <SearchField
            label="Partenza"
            placeholder="Es. Viganò, Lecco"
            value={startQuery}
            results={startResults}
            loading={startLoading}
            onSearch={searchStart}
            onChange={(value) => {
              setStartQuery(value)

              if (startPlace) {
                startMarkerRef.current?.remove()
                startMarkerRef.current = null

                setStartPlace(null)
                clearRouteData()
              }

              setStartResults([])
            }}
            onSelect={selectStart}
          />

          <SearchField
            label="Destinazione"
            placeholder="Es. Bolzano"
            value={destinationQuery}
            results={destinationResults}
            loading={destinationLoading}
            onSearch={
              searchDestination
            }
            onChange={(value) => {
              setDestinationQuery(value)

              if (destinationPlace) {
                destinationMarkerRef.current?.remove()

                destinationMarkerRef.current =
                  null

                setDestinationPlace(null)
                clearRouteData()
              }

              setDestinationResults([])
            }}
            onSelect={
              selectDestination
            }
          />

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
          <h2>Routing</h2>

          <p>
            Provider prototipo: OSRM
          </p>

          <p>
            Profilo attuale:
            Veloce / driving
          </p>
        </section>
      </>
    )
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
              Pianifica qui. Naviga con ciò
              che preferisci.
            </span>
          </div>
        </div>

        <div className="trip-summary">
          <strong>
            Nuovo viaggio
          </strong>

          <span>
            {distance !== null
              ? formatDistance(distance)
              : '— km'}
          </span>

          <span>
            {duration !== null
              ? formatDuration(duration)
              : '— guida'}
          </span>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={resetTrip}
          >
            + Nuovo
          </button>
        </div>
      </header>

      <nav className="section-tabs">
        <button
          type="button"
          className={
            activeSection === 'itinerary'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection('itinerary')
          }
        >
          Itinerario & Tappe
        </button>

        <button
          type="button"
          className={
            activeSection === 'fuel'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection('fuel')
          }
        >
          Rifornimenti
        </button>

        <button
          type="button"
          className={
            activeSection === 'breaks'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection('breaks')
          }
        >
          Pause & Pranzo
        </button>

        <button
          type="button"
          className={
            activeSection === 'days'
              ? 'section-tab active'
              : 'section-tab'
          }
          onClick={() =>
            setActiveSection('days')
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
            ref={mapContainerRef}
            className="map"
          />
        </main>
      </div>
    </div>
  )
}

export default App