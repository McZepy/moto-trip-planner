import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {
  loadAndActivateRuntimeFerryCatalog,
} from './ferries/ferryCatalogRuntimeLoader'

async function bootstrap() {
  const ferryCatalogResult =
    await loadAndActivateRuntimeFerryCatalog()

  if (import.meta.env.DEV) {
    if (
      ferryCatalogResult.status ===
      'loaded'
    ) {
      console.info(
        '[MotoRoute] FerryCatalog runtime attivo',
        {
          rawElements:
            ferryCatalogResult.build
              .rawElementCount,
          importedRoutes:
            ferryCatalogResult.build
              .importedRouteCount,
          importedTerminals:
            ferryCatalogResult.build
              .importedTerminalCount,
          routes:
            ferryCatalogResult.build
              .merge.catalog.routes.length,
          services:
            ferryCatalogResult.build
              .merge.catalog.services.length,
        },
      )
    } else {
      console.warn(
        '[MotoRoute] FerryCatalog seed attivo',
        ferryCatalogResult.reason,
      )
    }
  }

  createRoot(
    document.getElementById('root')!,
  ).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
