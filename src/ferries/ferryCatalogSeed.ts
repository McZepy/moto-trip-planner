import type {
  FerryCatalogData,
  FerryDataSource,
} from './ferryCatalogTypes'

const CHECKED_AT =
  '2026-09-17'

function operatorSource(
  provider: string,
  reference: string,
): FerryDataSource {
  return {
    kind: 'operator',
    provider,
    reference,
    checkedAt:
      CHECKED_AT,
  }
}

const FJORD_HIRTSHALS =
  operatorSource(
    'Fjord Line',
    'North Sea Terminal Hirtshals',
  )

const FJORD_BERGEN =
  operatorSource(
    'Fjord Line',
    'Jekteviksterminalen Bergen',
  )

const FJORD_KRISTIANSAND =
  operatorSource(
    'Fjord Line',
    'Kristiansand ferry terminal',
  )

const COLOR_HIRTSHALS_LARVIK =
  operatorSource(
    'Color Line',
    'Hirtshals-Larvik',
  )

const COLOR_HIRTSHALS_KRISTIANSAND =
  operatorSource(
    'Color Line',
    'Hirtshals-Kristiansand',
  )

const GNV_SARDINIA =
  operatorSource(
    'GNV',
    'Sardinia routes',
  )

const MOBY_SARDINIA =
  operatorSource(
    'MOBY / Tirrenia',
    'Sardinia routes',
  )

const GRIMALDI_SARDINIA =
  operatorSource(
    'Grimaldi Lines',
    'Sardinia routes',
  )

const TORGHATTEN_BODO_MOSKENES =
  operatorSource(
    'Torghatten',
    'https://www.torghatten.no/en/our-routes/18-782',
  )

const BODO_FERRY_TERMINAL_SOURCE:
  FerryDataSource = {
  kind: 'manual-verified',
  provider: 'OpenStreetMap',
  reference: 'node 7329411948 · Bodø ferjekai',
  checkedAt: CHECKED_AT,
}

const MOSKENES_FERRY_TERMINAL_SOURCE:
  FerryDataSource = {
  kind: 'manual-verified',
  provider: 'Havspor / OpenStreetMap',
  reference: 'Moskenes ferjekai',
  checkedAt: CHECKED_AT,
}

export const FERRY_CATALOG_SEED:
  FerryCatalogData = {
  ports: [
    {
      id: 'hirtshals',
      name: 'Hirtshals',
      countryCode: 'DK',
      countryName:
        'Danimarca',
      sources: [
        FJORD_HIRTSHALS,
        COLOR_HIRTSHALS_LARVIK,
      ],
    },
    {
      id: 'kristiansand',
      name: 'Kristiansand',
      countryCode: 'NO',
      countryName:
        'Norvegia',
      sources: [
        FJORD_KRISTIANSAND,
        COLOR_HIRTSHALS_KRISTIANSAND,
      ],
    },
    {
      id: 'larvik',
      name: 'Larvik',
      countryCode: 'NO',
      countryName:
        'Norvegia',
      sources: [
        COLOR_HIRTSHALS_LARVIK,
      ],
    },
    {
      id: 'bergen',
      name: 'Bergen',
      countryCode: 'NO',
      countryName:
        'Norvegia',
      sources: [
        FJORD_BERGEN,
      ],
    },

    {
      id: 'bodo',
      name: 'Bodø',
      countryCode: 'NO',
      countryName:
        'Norvegia',
      aliases: [
        'Bodo',
      ],
      sources: [
        TORGHATTEN_BODO_MOSKENES,
      ],
    },
    {
      id: 'moskenes',
      name: 'Moskenes',
      countryCode: 'NO',
      countryName:
        'Norvegia',
      sources: [
        TORGHATTEN_BODO_MOSKENES,
      ],
    },

    {
      id: 'genova',
      name: 'Genova',
      countryCode: 'IT',
      countryName:
        'Italia',
      aliases: [
        'Genoa',
      ],
      sources: [
        GNV_SARDINIA,
      ],
    },
    {
      id: 'livorno',
      name: 'Livorno',
      countryCode: 'IT',
      countryName:
        'Italia',
      sources: [
        MOBY_SARDINIA,
      ],
    },
    {
      id: 'piombino',
      name: 'Piombino',
      countryCode: 'IT',
      countryName:
        'Italia',
      sources: [
        MOBY_SARDINIA,
      ],
    },
    {
      id: 'civitavecchia',
      name: 'Civitavecchia',
      countryCode: 'IT',
      countryName:
        'Italia',
      sources: [
        MOBY_SARDINIA,
        GRIMALDI_SARDINIA,
      ],
    },
    {
      id: 'olbia',
      name: 'Olbia',
      countryCode: 'IT',
      countryName:
        'Italia',
      sources: [
        GNV_SARDINIA,
        MOBY_SARDINIA,
      ],
    },
    {
      id: 'porto-torres',
      name: 'Porto Torres',
      countryCode: 'IT',
      countryName:
        'Italia',
      sources: [
        GNV_SARDINIA,
        GRIMALDI_SARDINIA,
      ],
    },
  ],

  terminals: [
    {
      id:
        'hirtshals-fjord-line',
      portId:
        'hirtshals',

      name:
        'Fjord Line Terminal Hirtshals',

      address:
        'Nordsøterminalen, Containerkajen 4, 9850 Hirtshals',

      terminalPoint: {
        lat: 57.596364,
        lng: 9.973799,
      },

      vehicleAccessPoint: {
        lat: 57.596364,
        lng: 9.973799,
      },

      sources: [
        FJORD_HIRTSHALS,
      ],
    },

    {
      id:
        'hirtshals-color-line',
      portId:
        'hirtshals',

      name:
        'Color Line Terminal Hirtshals',

      address:
        'Fergeterminalen, Norgeskajen 2, 9850 Hirtshals',

      terminalPoint: {
        lat:
          57.592333,
        lng:
          9.966747,
      },

      vehicleAccessPoint: {
        lat:
          57.592333,
        lng:
          9.966747,
      },

      sources: [
        COLOR_HIRTSHALS_LARVIK,
      ],
    },

    {
      id:
        'kristiansand-fjord-line',
      portId:
        'kristiansand',

      name:
        'Kristiansand fergeterminal',

      address:
        'Vestre Strandgate 31, 4611 Kristiansand S',

      terminalPoint: {
        lat: 58.14412,
        lng: 7.985212,
      },

      vehicleAccessPoint: {
        lat: 58.14412,
        lng: 7.985212,
      },

      sources: [
        FJORD_KRISTIANSAND,
      ],
    },

    {
      id:
        'larvik-color-line',
      portId:
        'larvik',

      name:
        'Color Line Terminal Larvik',

      address:
        'Revet 8, 3255 Larvik',

      terminalPoint: {
        lat:
          59.040002,
        lng:
          10.048947,
      },

      vehicleAccessPoint: {
        lat:
          59.040002,
        lng:
          10.048947,
      },

      sources: [
        COLOR_HIRTSHALS_LARVIK,
      ],
    },

    {
      id:
        'bodo-torghatten',
      portId:
        'bodo',

      name:
        'Bodø ferjekai',

      terminalPoint: {
        lat: 67.28835,
        lng: 14.39415,
      },

      vehicleAccessPoint: {
        lat: 67.28835,
        lng: 14.39415,
      },

      sources: [
        BODO_FERRY_TERMINAL_SOURCE,
        TORGHATTEN_BODO_MOSKENES,
      ],
    },

    {
      id:
        'moskenes-torghatten',
      portId:
        'moskenes',

      name:
        'Moskenes ferjekai',

      address:
        'Birger Eriksens vei 35, 8392 Moskenes',

      terminalPoint: {
        lat: 67.8998,
        lng: 13.0440,
      },

      vehicleAccessPoint: {
        lat: 67.8998,
        lng: 13.0440,
      },

      sources: [
        MOSKENES_FERRY_TERMINAL_SOURCE,
        TORGHATTEN_BODO_MOSKENES,
      ],
    },

    {
      id:
        'bergen-fjord-line',
      portId:
        'bergen',

      name:
        'Jekteviksterminalen',

      address:
        'Nøstegaten 30, 5006 Bergen',

      terminalPoint: {
        lat: 60.392069,
        lng: 5.311952,
      },

      vehicleAccessPoint: {
        lat: 60.392069,
        lng: 5.311952,
      },

      sources: [
        FJORD_BERGEN,
      ],
    },
  ],

  routes: [
    {
      id:
        'hirtshals-kristiansand',
      portAId:
        'hirtshals',
      portBId:
        'kristiansand',
      bidirectional:
        true,
      distanceKm:
        135,

      sources: [
        FJORD_KRISTIANSAND,
        COLOR_HIRTSHALS_KRISTIANSAND,
      ],
    },

    {
      id:
        'hirtshals-larvik',
      portAId:
        'hirtshals',
      portBId:
        'larvik',
      bidirectional:
        true,

      sources: [
        COLOR_HIRTSHALS_LARVIK,
      ],
    },

    {
      id:
        'hirtshals-bergen',
      portAId:
        'hirtshals',
      portBId:
        'bergen',
      bidirectional:
        true,
      distanceKm:
        600,

      sources: [
        FJORD_HIRTSHALS,
        FJORD_BERGEN,
      ],
    },

    {
      id:
        'bodo-moskenes',
      portAId:
        'bodo',
      portBId:
        'moskenes',
      bidirectional:
        true,

      sources: [
        TORGHATTEN_BODO_MOSKENES,
      ],
    },

    {
      id:
        'genova-porto-torres',
      portAId:
        'genova',
      portBId:
        'porto-torres',
      bidirectional:
        true,

      sources: [
        GNV_SARDINIA,
      ],
    },

    {
      id:
        'genova-olbia',
      portAId:
        'genova',
      portBId:
        'olbia',
      bidirectional:
        true,

      sources: [
        GNV_SARDINIA,
        MOBY_SARDINIA,
      ],
    },

    {
      id:
        'livorno-olbia',
      portAId:
        'livorno',
      portBId:
        'olbia',
      bidirectional:
        true,

      sources: [
        MOBY_SARDINIA,
      ],
    },

    {
      id:
        'civitavecchia-olbia',
      portAId:
        'civitavecchia',
      portBId:
        'olbia',
      bidirectional:
        true,

      sources: [
        MOBY_SARDINIA,
        GRIMALDI_SARDINIA,
      ],
    },

    {
      id:
        'civitavecchia-porto-torres',
      portAId:
        'civitavecchia',
      portBId:
        'porto-torres',
      bidirectional:
        true,

      sources: [
        GRIMALDI_SARDINIA,
      ],
    },
  ],

  services: [
    {
      id:
        'fjord-hirtshals-kristiansand',

      routeId:
        'hirtshals-kristiansand',

      operator:
        'Fjord Line',

      terminalAId:
        'hirtshals-fjord-line',

      terminalBId:
        'kristiansand-fjord-line',

      motorcycleAllowed:
        true,

      durationMinutesMin:
        235,
      durationMinutesMax:
        235,

      sources: [
        FJORD_KRISTIANSAND,
      ],
    },

    {
      id:
        'color-hirtshals-kristiansand',

      routeId:
        'hirtshals-kristiansand',

      operator:
        'Color Line',

      motorcycleAllowed:
        true,

      sources: [
        COLOR_HIRTSHALS_KRISTIANSAND,
      ],
    },

    {
      id:
        'color-hirtshals-larvik',

      routeId:
        'hirtshals-larvik',

      operator:
        'Color Line',

      terminalAId:
        'hirtshals-color-line',

      terminalBId:
        'larvik-color-line',

      motorcycleAllowed:
        true,

      yearRound:
        true,

      sources: [
        COLOR_HIRTSHALS_LARVIK,
      ],
    },

    {
      id:
        'fjord-hirtshals-bergen',

      routeId:
        'hirtshals-bergen',

      operator:
        'Fjord Line',

      terminalAId:
        'hirtshals-fjord-line',

      terminalBId:
        'bergen-fjord-line',

      motorcycleAllowed:
        true,

      durationMinutesMin:
        1050,
      durationMinutesMax:
        1050,

      sources: [
        FJORD_HIRTSHALS,
        FJORD_BERGEN,
      ],
    },

    {
      id:
        'torghatten-bodo-moskenes',

      routeId:
        'bodo-moskenes',

      operator:
        'Torghatten',

      terminalAId:
        'bodo-torghatten',

      terminalBId:
        'moskenes-torghatten',

      motorcycleAllowed:
        true,

      durationMinutesMin:
        210,

      durationMinutesMax:
        240,

      seasonNotes:
        'Durata indicativa per il routing. Verificare orari e prenotazione per la data del viaggio.',

      sources: [
        TORGHATTEN_BODO_MOSKENES,
      ],
    },

    {
      id:
        'gnv-genova-porto-torres',

      routeId:
        'genova-porto-torres',

      operator:
        'GNV',

      motorcycleAllowed:
        true,

      durationMinutesMin:
        750,
      durationMinutesMax:
        780,

      seasonNotes:
        'Servizio stagionale: verificare date operative.',

      sources: [
        GNV_SARDINIA,
      ],
    },

    {
      id:
        'gnv-genova-olbia',

      routeId:
        'genova-olbia',

      operator:
        'GNV',

      motorcycleAllowed:
        true,

      durationMinutesMin:
        720,
      durationMinutesMax:
        780,

      seasonNotes:
        'Servizio stagionale: verificare date operative.',

      sources: [
        GNV_SARDINIA,
      ],
    },

    {
      id:
        'moby-livorno-olbia',

      routeId:
        'livorno-olbia',

      operator:
        'MOBY',

      motorcycleAllowed:
        true,

      yearRound:
        true,

      durationMinutesMin:
        470,
      durationMinutesMax:
        540,

      sources: [
        MOBY_SARDINIA,
      ],
    },

    {
      id:
        'tirrenia-civitavecchia-olbia',

      routeId:
        'civitavecchia-olbia',

      operator:
        'Tirrenia',

      motorcycleAllowed:
        true,

      yearRound:
        true,

      durationMinutesMin:
        420,
      durationMinutesMax:
        480,

      sources: [
        MOBY_SARDINIA,
      ],
    },

    {
      id:
        'grimaldi-civitavecchia-porto-torres',

      routeId:
        'civitavecchia-porto-torres',

      operator:
        'Grimaldi Lines',

      motorcycleAllowed:
        true,

      sources: [
        GRIMALDI_SARDINIA,
      ],
    },
  ],
}
