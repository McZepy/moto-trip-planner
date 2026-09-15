import './App.css'

function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>Moto Trip Planner</h1>
          <p>Pianifica qui. Naviga con ciò che preferisci.</p>
        </div>

        <section className="sidebar-section">
          <h2>Percorso</h2>
          <p>La pianificazione del viaggio verrà costruita qui.</p>
        </section>
      </aside>

      <main className="map-area">
        <div className="map-placeholder">
          <h2>Mappa</h2>
          <p>MapLibre verrà aggiunto nella V0.2.</p>
        </div>
      </main>
    </div>
  )
}

export default App