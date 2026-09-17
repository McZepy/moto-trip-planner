import { rankAutocompleteSuggestions } from '../providers/autocompleteRanking'
import type { SmartGeocodingResult } from '../providers/autocompleteProvider'

function item(
  name: string,
  type: string,
  category: string,
  kind: SmartGeocodingResult['kind'],
  lat = 0,
  lng = 0,
): SmartGeocodingResult {
  return {
    id: `${name}-${type}-${kind}`,
    name,
    label: `${name}, test`,
    lat,
    lng,
    type,
    category,
    kind,
    source: 'locationiq',
  }
}

const tests = [
  {
    name: 'Como città prima del confine amministrativo',
    run: () => {
      const ranked = rankAutocompleteSuggestions('Como', [
        item('Como', 'administrative', 'boundary', 'poi'),
        item('Como', 'city', 'place', 'place'),
      ])
      return ranked[0]?.type === 'city'
    },
  },
  {
    name: 'Viganò località prima di un POI omonimo',
    run: () => {
      const ranked = rankAutocompleteSuggestions('Viganò', [
        item('Viganò', 'attraction', 'tourism', 'poi'),
        item('Viganò', 'village', 'place', 'place'),
      ])
      return ranked[0]?.type === 'village'
    },
  },
  {
    name: 'Bergen città prima della regione',
    run: () => {
      const ranked = rankAutocompleteSuggestions('Bergen', [
        item('Bergen', 'region', 'boundary', 'poi'),
        item('Bergen', 'city', 'place', 'place'),
      ])
      return ranked[0]?.type === 'city'
    },
  },
  {
    name: 'Indirizzo non supera località omonima senza numero civico',
    run: () => {
      const ranked = rankAutocompleteSuggestions('Como', [
        item('Como', 'road', 'highway', 'address'),
        item('Como', 'city', 'place', 'place'),
      ])
      return ranked[0]?.kind === 'place'
    },
  },
  {
    name: 'Ricerca porto mantiene il ranking specializzato esistente',
    run: () => {
      const port = item(
        'Porto di Hirtshals – Terminal Traghetti',
        'ferry_terminal',
        'amenity',
        'ferry-terminal',
      )
      const city = item('Hirtshals', 'town', 'place', 'place')
      const ranked = rankAutocompleteSuggestions('Porto di Hirtshals', [
        port,
        city,
      ])
      return ranked[0]?.id === port.id
    },
  },
]

const results = tests.map((test) => ({
  name: test.name,
  ok: test.run(),
}))

const passed = results.filter((result) => result.ok).length
const root = document.getElementById('test-root')

if (!root) {
  throw new Error('Elemento #test-root non trovato.')
}

root.innerHTML = `
  <h1>MotoRoute · Ranking località</h1>
  <div class="summary ${passed === results.length ? 'ok-summary' : 'ko-summary'}">
    ${passed}/${results.length} test superati
  </div>
  ${results
    .map(
      (result) => `
        <div class="test-row ${result.ok ? 'ok' : 'ko'}">
          <strong>${result.ok ? 'OK' : 'KO'}</strong>
          <span>${result.name}</span>
        </div>
      `,
    )
    .join('')}
`
