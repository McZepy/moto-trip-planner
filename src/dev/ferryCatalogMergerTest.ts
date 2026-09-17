import type {
  FerryCatalogData,
} from '../ferries/ferryCatalogTypes'

import {
  mergeFerryCatalogs,
} from '../ferries/ferryCatalogMerger'

type TestResult = {
  name: string
  ok: boolean
  detail: string
}

const primary:
  FerryCatalogData = {
  ports: [
    {
      id: 'hirtshals',
      name: 'Hirtshals',
      countryCode: 'DK',
      countryName: 'Danimarca',
      sources: [
        {
          kind: 'manual-verified',
          provider: 'MotoRoute',
          reference: 'Hirtshals verificato',
        },
      ],
    },
    {
      id: 'larvik',
      name: 'Larvik',
      countryCode: 'NO',
      countryName: 'Norvegia',
      sources: [
        {
          kind: 'manual-verified',
          provider: 'MotoRoute',
          reference: 'Larvik verificato',
        },
      ],
    },
  ],

  terminals: [
    {
      id: 'hirtshals-verified',
      portId: 'hirtshals',
      name: 'Color Line Terminal Hirtshals',
      vehicleAccessPoint: {
        lat: 57.592333,
        lng: 9.966747,
      },
      sources: [
        {
          kind: 'manual-verified',
          provider: 'MotoRoute',
        },
      ],
    },
    {
      id: 'larvik-verified',
      portId: 'larvik',
      name: 'Color Line Terminal Larvik',
      vehicleAccessPoint: {
        lat: 59.040002,
        lng: 10.048947,
      },
      sources: [
        {
          kind: 'manual-verified',
          provider: 'MotoRoute',
        },
      ],
    },
  ],

  routes: [
    {
      id: 'hirtshals-larvik',
      portAId: 'hirtshals',
      portBId: 'larvik',
      bidirectional: true,
      distanceKm: 163,
      sources: [
        {
          kind: 'manual-verified',
          provider: 'MotoRoute',
        },
      ],
    },
  ],

  services: [
    {
      id: 'color-hirtshals-larvik',
      routeId: 'hirtshals-larvik',
      operator: 'Color Line',
      terminalAId: 'hirtshals-verified',
      terminalBId: 'larvik-verified',
      motorcycleAllowed: true,
      durationMinutesMin: 225,
      durationMinutesMax: 225,
      sources: [
        {
          kind: 'manual-verified',
          provider: 'MotoRoute',
        },
      ],
    },
  ],
}

const supplement:
  FerryCatalogData = {
  ports: [
    {
      id: 'osm-hirtshals',
      name: 'Hirtshals Ferry Terminal',
      countryCode: 'XX',
      countryName: 'Da determinare',
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
          reference: 'node/1001',
        },
      ],
    },
    {
      id: 'osm-larvik',
      name: 'Larvik Ferry Terminal',
      countryCode: 'XX',
      countryName: 'Da determinare',
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
          reference: 'node/1002',
        },
      ],
    },
    {
      id: 'osm-stavanger',
      name: 'Stavanger',
      countryCode: 'XX',
      countryName: 'Da determinare',
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
          reference: 'node/1003',
        },
      ],
    },
  ],

  terminals: [
    {
      id: 'osm-terminal-hirtshals',
      portId: 'osm-hirtshals',
      name: 'Hirtshals ferry terminal',
      terminalPoint: {
        lat: 57.59235,
        lng: 9.96676,
      },
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
    {
      id: 'osm-terminal-larvik',
      portId: 'osm-larvik',
      name: 'Larvik ferry terminal',
      terminalPoint: {
        lat: 59.04001,
        lng: 10.04895,
      },
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
    {
      id: 'osm-terminal-stavanger',
      portId: 'osm-stavanger',
      name: 'Stavanger ferry terminal',
      terminalPoint: {
        lat: 58.969975,
        lng: 5.733107,
      },
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
  ],

  routes: [
    {
      id: 'osm-route-hirtshals-larvik',
      portAId: 'osm-hirtshals',
      portBId: 'osm-larvik',
      bidirectional: true,
      distanceKm: 170,
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
    {
      id: 'osm-route-hirtshals-stavanger',
      portAId: 'osm-hirtshals',
      portBId: 'osm-stavanger',
      bidirectional: true,
      distanceKm: 360,
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
  ],

  services: [
    {
      id: 'osm-service-color-larvik',
      routeId: 'osm-route-hirtshals-larvik',
      operator: 'Color Line',
      terminalAId: 'osm-terminal-hirtshals',
      terminalBId: 'osm-terminal-larvik',
      motorcycleAllowed: false,
      durationMinutesMin: 999,
      durationMinutesMax: 999,
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
    {
      id: 'osm-service-stavanger',
      routeId: 'osm-route-hirtshals-stavanger',
      operator: 'OSM Operator',
      terminalAId: 'osm-terminal-hirtshals',
      terminalBId: 'osm-terminal-stavanger',
      motorcycleAllowed: true,
      durationMinutesMin: 600,
      durationMinutesMax: 600,
      sources: [
        {
          kind: 'osm',
          provider: 'OpenStreetMap',
        },
      ],
    },
  ],
}

function runTests() {
  const result =
    mergeFerryCatalogs(
      primary,
      supplement,
    )

  const catalog =
    result.catalog

  const tests:
    TestResult[] = []

  tests.push({
    name:
      'Porti duplicati riconosciuti',
    ok:
      catalog.ports.filter(
        (port) =>
          port.name
            .toLowerCase()
            .includes('hirtshals'),
      ).length === 1 &&
      catalog.ports.filter(
        (port) =>
          port.name
            .toLowerCase()
            .includes('larvik'),
      ).length === 1,
    detail:
      `${result.stats.matchedPorts} porti OSM agganciati a porti già verificati.`,
  })

  const verifiedRoute =
    catalog.routes.find(
      (route) =>
        route.id ===
        'hirtshals-larvik',
    )

  tests.push({
    name:
      'Rotta verificata mantiene priorità',
    ok:
      verifiedRoute
        ?.distanceKm ===
        163 &&
      result.stats
        .matchedRoutes ===
        1,
    detail:
      `Distanza finale ${verifiedRoute?.distanceKm ?? 'n.d.'} km; il valore OSM non deve sovrascrivere quello verificato.`,
  })

  const verifiedService =
    catalog.services.find(
      (service) =>
        service.id ===
        'color-hirtshals-larvik',
    )

  tests.push({
    name:
      'Dati servizio verificati protetti',
    ok:
      verifiedService
        ?.motorcycleAllowed ===
        true &&
      verifiedService
        .durationMinutesMin ===
        225 &&
      verifiedService
        .durationMinutesMax ===
        225,
    detail:
      'OSM non deve sostituire moto ammesse o durata già verificate.',
  })

  const stavangerRoute =
    catalog.routes.find(
      (route) =>
        route.portAId ===
          'hirtshals' &&
        route.portBId ===
          'osm-stavanger',
    )

  tests.push({
    name:
      'Nuova rotta OSM aggiunta',
    ok:
      Boolean(stavangerRoute) &&
      result.stats
        .addedRoutes ===
        1,
    detail:
      'Una rotta non presente nel catalogo verificato deve essere aggiunta automaticamente.',
  })

  const stavangerService =
    catalog.services.find(
      (service) =>
        service.routeId ===
        stavangerRoute?.id,
    )

  tests.push({
    name:
      'Nuovo servizio OSM instradabile',
    ok:
      Boolean(
        stavangerService
          ?.terminalAId &&
        stavangerService
          .terminalBId,
      ),
    detail:
      'I terminal del supplemento devono essere rimappati sui porti finali.',
  })

  tests.push({
    name:
      'Fonti OSM conservate senza perdere quelle verificate',
    ok:
      Boolean(
        verifiedRoute
          ?.sources.some(
            (source) =>
              source.kind ===
              'manual-verified',
          ) &&
        verifiedRoute
          .sources.some(
            (source) =>
              source.kind ===
              'osm',
          ),
      ),
    detail:
      'La fusione deve conservare la provenienza di entrambi i livelli dati.',
  })

  return {
    result,
    tests,
  }
}

const root =
  document.querySelector<HTMLDivElement>(
    '#test-root',
  )

if (!root) {
  throw new Error(
    'Contenitore test non trovato.',
  )
}

const {
  result,
  tests,
} = runTests()

const passed =
  tests.filter(
    (test) => test.ok,
  ).length

root.innerHTML = `
  <h1>
    MotoRoute · FerryCatalog Merger Test
  </h1>

  <p class="summary ${
    passed === tests.length
      ? 'ok-summary'
      : 'ko-summary'
  }">
    ${passed}/${tests.length}
    test superati
  </p>

  <p class="note">
    Catalogo finale: ${result.catalog.ports.length} porti,
    ${result.catalog.terminals.length} terminal,
    ${result.catalog.routes.length} rotte,
    ${result.catalog.services.length} servizi.
  </p>

  ${tests
    .map(
      (test) => `
        <div class="test-row ${test.ok ? 'ok' : 'ko'}">
          <div class="test-status">
            ${test.ok ? 'PASS' : 'FAIL'}
          </div>
          <div>
            <strong>${test.name}</strong>
            <div class="test-detail">
              ${test.detail}
            </div>
          </div>
        </div>
      `,
    )
    .join('')}
`
