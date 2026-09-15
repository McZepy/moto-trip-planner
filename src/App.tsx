import { useEffect, useRef } from 'react'
import {
  Map,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import './App.css'
import { mapProvider } from './config/mapProvider'

setWorkerUrl(workerUrl)

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

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

    return () => {
      map.remove()
    }
  }, [])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Moto Trip Planner</h1>
          <p>Pianifica qui. Naviga con ciò che preferisci.</p>
        </div>

        <section className="sidebar-section">
          <h2>Percorso</h2>
          <p>
            Partenza, destinazione e routing verranno aggiunti
            nella fase successiva della V0.2.
          </p>
        </section>

        <section className="sidebar-section">
          <h2>Mappa</h2>
          <p>Cartografia: {mapProvider.name}</p>
        </section>
      </aside>

      <main className="map-area">
        <div ref={mapContainerRef} className="map" />
      </main>
    </div>
  )
}

export default App