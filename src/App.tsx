import { useEffect, useRef, useState } from 'react'
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

setWorkerUrl(workerUrl)

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

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  const [startPoint, setStartPoint] =
    useState<RoutePoint | null>(null)

  const [destinationPoint, setDestinationPoint] =
    useState<RoutePoint | null>(null)

  const [distance, setDistance] =
    useState<number | null>(null)

  const [duration, setDuration] =
    useState<number | null>(null)

  const [status, setStatus] = useState(
    'Clicca sulla mappa per scegliere la partenza.',
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

    let start: RoutePoint | null = null
    let destination: RoutePoint | null = null

    let startMarker: Marker | null = null
    let destinationMarker: Marker | null = null

    const removeRoute = () => {
      if (map.getLayer('route')) {
        map.removeLayer('route')
      }

      if (map.getSource('route')) {
        map.removeSource('route')
      }
    }

    const resetRoute = () => {
      start = null
      destination = null

      startMarker?.remove()
      destinationMarker?.remove()

      startMarker = null
      destinationMarker = null

      removeRoute()

      setStartPoint(null)
      setDestinationPoint(null)
      setDistance(null)
      setDuration(null)

      setStatus(
        'Clicca sulla mappa per scegliere la partenza.',
      )
    }

    map.on('click', async (event) => {
      const point: RoutePoint = {
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
      }

      if (start && destination) {
        resetRoute()
      }

      if (!start) {
        start = point
        setStartPoint(point)

        startMarker = new Marker({
          color: '#16a34a',
        })
          .setLngLat([point.lng, point.lat])
          .addTo(map)

        setStatus(
          'Partenza impostata. Clicca sulla destinazione.',
        )

        return
      }

      destination = point
      setDestinationPoint(point)

      destinationMarker = new Marker({
        color: '#dc2626',
      })
        .setLngLat([point.lng, point.lat])
        .addTo(map)

      setStatus('Calcolo percorso...')

      try {
        const route =
          await osrmRoutingProvider.calculateRoute(
            start,
            destination,
          )

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

        const bounds = coordinates.reduce(
          (currentBounds, coordinate) => {
            return currentBounds.extend(
              coordinate as [number, number],
            )
          },
          new LngLatBounds(
            coordinates[0] as [number, number],
            coordinates[0] as [number, number],
          ),
        )

        map.fitBounds(bounds, {
          padding: 70,
        })

        setDistance(route.distanceMeters)
        setDuration(route.durationSeconds)

        setStatus(
          'Percorso calcolato. Clicca ancora sulla mappa per iniziarne uno nuovo.',
        )
      } catch (error) {
        console.error(error)

        setStatus(
          error instanceof Error
            ? error.message
            : 'Errore durante il calcolo del percorso.',
        )
      }
    })

    return () => {
      map.remove()
    }
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Moto Trip Planner</h1>
          <p>
            Pianifica qui. Naviga con ciò che preferisci.
          </p>
        </div>

        <section className="sidebar-section">
          <h2>Percorso</h2>

          <p className="route-status">
            {status}
          </p>

          {startPoint && (
            <div className="route-point">
              <strong>Partenza</strong>
              <span>
                {startPoint.lat.toFixed(5)},{' '}
                {startPoint.lng.toFixed(5)}
              </span>
            </div>
          )}

          {destinationPoint && (
            <div className="route-point">
              <strong>Destinazione</strong>
              <span>
                {destinationPoint.lat.toFixed(5)},{' '}
                {destinationPoint.lng.toFixed(5)}
              </span>
            </div>
          )}

          {distance !== null &&
            duration !== null && (
              <div className="route-summary">
                <div>
                  <span>Distanza</span>
                  <strong>
                    {formatDistance(distance)}
                  </strong>
                </div>

                <div>
                  <span>Guida stimata</span>
                  <strong>
                    {formatDuration(duration)}
                  </strong>
                </div>
              </div>
            )}
        </section>

        <section className="sidebar-section">
          <h2>Routing</h2>
          <p>Provider prototipo: OSRM</p>
          <p>Profilo attuale: Veloce / driving</p>
        </section>

        <section className="sidebar-section">
          <h2>Mappa</h2>
          <p>
            Cartografia: {mapProvider.name}
          </p>
        </section>
      </aside>

      <main className="map-area">
        <div
          ref={mapContainerRef}
          className="map"
        />
      </main>
    </div>
  )
}

export default App