export type FerryGeoPoint = {
  lat: number
  lng: number
}

export type FerryDataSourceKind =
  | 'osm'
  | 'operator'
  | 'gtfs'
  | 'manual-verified'

export type FerryDataSource = {
  kind: FerryDataSourceKind
  provider: string
  reference?: string
  checkedAt?: string
}

export type FerryPort = {
  id: string
  name: string

  countryCode: string
  countryName: string

  aliases?: string[]

  sources: FerryDataSource[]
}

export type FerryTerminal = {
  id: string
  portId: string

  name: string
  address?: string

  terminalPoint?: FerryGeoPoint

  /*
   * Punto realmente utile al navigatore
   * per l'accesso veicoli/check-in.
   */
  vehicleAccessPoint?: FerryGeoPoint

  sources: FerryDataSource[]
}

export type FerryRoute = {
  id: string

  portAId: string
  portBId: string

  bidirectional: boolean

  distanceKm?: number

  sources: FerryDataSource[]
}

export type FerryService = {
  id: string
  routeId: string

  operator: string

  /*
   * Possono essere assenti finché
   * non abbiamo verificato i terminal.
   */
  terminalAId?: string
  terminalBId?: string

  motorcycleAllowed?: boolean

  yearRound?: boolean

  durationMinutesMin?: number
  durationMinutesMax?: number

  seasonNotes?: string

  sources: FerryDataSource[]
}

export type FerryCatalogData = {
  ports: FerryPort[]
  terminals: FerryTerminal[]
  routes: FerryRoute[]
  services: FerryService[]
}
