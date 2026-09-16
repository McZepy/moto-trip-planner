import { useState } from 'react'

import type { TripRecord } from '../storage/tripStorage'

type TripsModalProps = {
  open: boolean
  trips: TripRecord[]
  currentTripId: string | null

  onClose: () => void
  onLoad: (trip: TripRecord) => void
  onDuplicate: (trip: TripRecord) => void
  onDelete: (trip: TripRecord) => void
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    'it-IT',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(new Date(value))
}

function formatDistance(
  meters: number | null,
) {
  if (meters === null) {
    return '— km'
  }

  return `${(meters / 1000).toFixed(1)} km`
}

export function TripsModal({
  open,
  trips,
  currentTripId,
  onClose,
  onLoad,
  onDuplicate,
  onDelete,
}: TripsModalProps) {
  const [
    tripToDelete,
    setTripToDelete,
  ] = useState<TripRecord | null>(null)

  if (!open) {
    return null
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="trips-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-header">
          <div>
            <h2>I miei Viaggi</h2>

            <p>
              Viaggi salvati su questo
              browser.
            </p>
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="modal-content">
          {trips.length === 0 ? (
            <div className="empty-trips">
              <strong>
                Nessun viaggio salvato
              </strong>

              <p>
                Crea un itinerario e premi
                Salva.
              </p>
            </div>
          ) : (
            trips.map((trip) => {
              const isActive =
                trip.id === currentTripId

              return (
                <div
                  className={
                    isActive
                      ? 'saved-trip active-trip'
                      : 'saved-trip'
                  }
                  key={trip.id}
                >
                  <div className="saved-trip-info">
                    <div className="saved-trip-title-row">
                      <strong>
                        {trip.name}
                      </strong>

                      {isActive && (
                        <span className="active-trip-badge">
                          ATTIVO
                        </span>
                      )}
                    </div>

                    <span className="saved-trip-route">
                      {trip.startPlace?.name ??
                        'Partenza non impostata'}
                      {' → '}
                      {trip.destinationPlace?.name ??
                        'Destinazione non impostata'}
                    </span>

                    <small>
                      {formatDistance(
                        trip.distance,
                      )}
                      {' · '}
                      {formatDate(
                        trip.updatedAt,
                      )}
                    </small>
                  </div>

                  <div className="saved-trip-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onLoad(trip)
                      }
                    >
                      Carica
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDuplicate(trip)
                      }
                    >
                      Duplica
                    </button>

                    <button
                      type="button"
                      className="danger-action"
                      onClick={() =>
                        setTripToDelete(trip)
                      }
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {tripToDelete && (
        <div
          className="confirm-backdrop"
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <div className="confirm-dialog">
            <h3>Eliminare il viaggio?</h3>

            <p>
              Stai per eliminare
              <strong>
                {' '}
                {tripToDelete.name}
              </strong>
              .
            </p>

            <p className="confirm-note">
              Questa operazione non può
              essere annullata.
            </p>

            <div className="confirm-actions">
              <button
                type="button"
                onClick={() =>
                  setTripToDelete(null)
                }
              >
                Annulla
              </button>

              <button
                type="button"
                className="confirm-delete"
                onClick={() => {
                  onDelete(tripToDelete)
                  setTripToDelete(null)
                }}
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}