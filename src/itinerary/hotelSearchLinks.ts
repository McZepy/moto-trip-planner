export type HotelPlatform =
  | 'booking'
  | 'google-hotels'
  | 'hotels'
  | 'airbnb'
  | 'trivago'
  | 'expedia'
  | 'skyscanner'

export const HOTEL_PLATFORM_LABELS:
  Record<
    HotelPlatform,
    string
  > = {
  booking:
    'Booking.com',
  'google-hotels':
    'Google Hotels',
  hotels:
    'Hotels.com',
  airbnb:
    'Airbnb',
  trivago:
    'Trivago',
  expedia:
    'Expedia',
  skyscanner:
    'Skyscanner',
}

function encode(
  value: string,
) {
  return encodeURIComponent(
    value.trim(),
  )
}

export function hotelSearchUrl(
  platform:
    HotelPlatform,
  place:
    string,
  checkIn:
    string,
  checkOut:
    string,
) {
  const location =
    encode(
      place,
    )

  if (
    platform ===
    'booking'
  ) {
    return (
      'https://www.booking.com/searchresults.it.html' +
      '?ss=' +
      location +
      '&checkin=' +
      encode(
        checkIn,
      ) +
      '&checkout=' +
      encode(
        checkOut,
      ) +
      '&group_adults=2' +
      '&group_children=0' +
      '&no_rooms=1'
    )
  }

  if (
    platform ===
    'hotels'
  ) {
    return (
      'https://www.hotels.com/Hotel-Search' +
      '?destination=' +
      location +
      '&startDate=' +
      encode(
        checkIn,
      ) +
      '&endDate=' +
      encode(
        checkOut,
      )
    )
  }

  if (
    platform ===
    'airbnb'
  ) {
    return (
      'https://www.airbnb.it/s/' +
      location +
      '/homes' +
      '?checkin=' +
      encode(
        checkIn,
      ) +
      '&checkout=' +
      encode(
        checkOut,
      ) +
      '&adults=2'
    )
  }

  if (
    platform ===
    'expedia'
  ) {
    return (
      'https://www.expedia.it/Hotel-Search' +
      '?destination=' +
      location +
      '&startDate=' +
      encode(
        checkIn,
      ) +
      '&endDate=' +
      encode(
        checkOut,
      ) +
      '&adults=2' +
      '&rooms=1'
    )
  }

  if (
    platform ===
    'trivago'
  ) {
    return (
      'https://www.trivago.it/' +
      '?query=' +
      location +
      '&checkin=' +
      encode(
        checkIn,
      ) +
      '&checkout=' +
      encode(
        checkOut,
      )
    )
  }

  if (
    platform ===
    'skyscanner'
  ) {
    return (
      'https://www.skyscanner.it/hotel' +
      '?query=' +
      location +
      '&checkin=' +
      encode(
        checkIn,
      ) +
      '&checkout=' +
      encode(
        checkOut,
      ) +
      '&adults=2' +
      '&rooms=1'
    )
  }

  return (
    'https://www.google.com/travel/hotels' +
    '?q=' +
    encode(
      'hotel ' +
      place,
    ) +
    '&checkin=' +
    encode(
      checkIn,
    ) +
    '&checkout=' +
    encode(
      checkOut,
    )
  )
}
