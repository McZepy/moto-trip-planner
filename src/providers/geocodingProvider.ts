export type GeoBoundingBox = {
  south: number
  north: number
  west: number
  east: number
}

export type GeocodingResult = {
  id: string

  name: string
  label: string

  lat: number
  lng: number

  category?: string
  type?: string

  osmType?: string
  osmId?: number

  boundingBox?: GeoBoundingBox
}

export interface GeocodingProvider {
  search(
    query: string,
  ): Promise<GeocodingResult[]>
}

type NominatimResult = {
  place_id: number

  osm_type?: string
  osm_id?: number

  lat: string
  lon: string

  name?: string
  display_name: string

  category?: string
  type?: string
  addresstype?: string

  boundingbox?: [
    string,
    string,
    string,
    string,
  ]

  address?: {
    road?: string
    village?: string
    town?: string
    city?: string
    municipality?: string
    county?: string
    state?: string
    country?: string
  }
}

const NOMINATIM_BASE_URL =
  'https://nominatim.openstreetmap.org'

function getResultName(
  result: NominatimResult,
) {
  return (
    result.name ??
    result.address?.road ??
    result.address?.village ??
    result.address?.town ??
    result.address?.city ??
    result.address?.municipality ??
    result.display_name.split(',')[0] ??
    'Località senza nome'
  )
}

function getBoundingBox(
  result: NominatimResult,
): GeoBoundingBox | undefined {
  if (!result.boundingbox) {
    return undefined
  }

  const [
    south,
    north,
    west,
    east,
  ] = result.boundingbox.map(Number)

  if (
    !Number.isFinite(south) ||
    !Number.isFinite(north) ||
    !Number.isFinite(west) ||
    !Number.isFinite(east)
  ) {
    return undefined
  }

  return {
    south,
    north,
    west,
    east,
  }
}

export const nominatimGeocodingProvider: GeocodingProvider =
  {
    async search(query) {
      const trimmedQuery =
        query.trim()

      if (
        trimmedQuery.length < 3
      ) {
        return []
      }

      const params =
        new URLSearchParams({
          q: trimmedQuery,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '6',
          'accept-language': 'it',
        })

      const response =
        await fetch(
          `${NOMINATIM_BASE_URL}/search?${params.toString()}`,
          {
            headers: {
              Accept:
                'application/json',
            },
          },
        )

      if (!response.ok) {
        throw new Error(
          `Ricerca località non disponibile (${response.status})`,
        )
      }

      const data =
        (await response.json()) as NominatimResult[]

      return data.map(
        (result) => ({
          id:
            String(
              result.place_id,
            ),

          name:
            getResultName(
              result,
            ),

          label:
            result.display_name,

          lat:
            Number(result.lat),

          lng:
            Number(result.lon),

          category:
            result.category,

          type:
            result.addresstype ??
            result.type,

          osmType:
            result.osm_type,

          osmId:
            result.osm_id,

          boundingBox:
            getBoundingBox(
              result,
            ),
        }),
      )
    },
  }