import {
  useEffect,
  useState,
} from 'react'

import {
  routeStyleLabels,
  tripDurationLabels,
  tripShapeLabels,
  type TripSettings,
} from '../types/trip'

import './TripSettingsModal.css'

type TripSettingsModalProps = {
  open: boolean
  settings: TripSettings
  onClose: () => void
  onApply: (
    settings: TripSettings,
  ) => void
}

function inclusiveDaysBetween(
  start: string,
  end: string,
) {
  if (
    !start ||
    !end
  ) {
    return null
  }

  const startDate =
    new Date(
      start +
        'T12:00:00',
    )

  const endDate =
    new Date(
      end +
        'T12:00:00',
    )

  const difference =
    Math.round(
      (
        endDate.getTime() -
        startDate.getTime()
      ) /
      86_400_000,
    )

  if (
    !Number.isFinite(
      difference,
    ) ||
    difference <
      0
  ) {
    return null
  }

  return difference + 1
}

function withDerivedDuration(
  settings:
    TripSettings,
) {
  const days =
    inclusiveDaysBetween(
      settings.departureDate,
      settings.returnDate,
    )

  if (!days) {
    return settings
  }

  return {
    ...settings,

    durationMode:
      days === 1
        ? 'single-day' as const
        : 'multi-day' as const,

    plannedDays:
      days,
  }
}

function cloneSettings(
  settings: TripSettings,
): TripSettings {
  return {
    ...settings,
    roadPreferences: {
      ...settings.roadPreferences,
    },
  }
}

export function TripSettingsModal({
  open,
  settings,
  onClose,
  onApply,
}: TripSettingsModalProps) {
  const [
    draft,
    setDraft,
  ] =
    useState<TripSettings>(
      () =>
        cloneSettings(
          settings,
        ),
    )

  useEffect(() => {
    if (open) {
      setDraft(
        cloneSettings(
          settings,
        ),
      )
    }
  }, [
    open,
    settings,
  ])

  if (!open) {
    return null
  }

  const updateRoadPreference =
    (
      key:
        keyof TripSettings['roadPreferences'],
      value:
        boolean,
    ) => {
      setDraft(
        (current) => ({
          ...current,
          roadPreferences: {
            ...current.roadPreferences,
            [key]:
              value,
          },
        }),
      )
    }

  return (
    <div
      className="trip-settings-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="trip-settings-dialog"
        onMouseDown={(
          event,
        ) =>
          event.stopPropagation()
        }
      >
        <div className="trip-settings-header">
          <div>
            <h2>
              Impostazioni viaggio
            </h2>
            <p>
              Struttura generale e
              preferenze del percorso.
            </p>
          </div>

          <button
            type="button"
            className="trip-settings-close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="trip-settings-content">
          <section className="trip-settings-section">
            <h3>
              Organizzazione
            </h3>

            <div className="trip-settings-field">
              <label>
                Durata disponibile
              </label>

              <div className="trip-settings-auto-days">
                {(() => {
                  const days =
                    inclusiveDaysBetween(
                      draft.departureDate,
                      draft.returnDate,
                    )

                  return days
                    ? `${days} ${days === 1 ? 'giorno' : 'giorni'}`
                    : 'Imposta data di partenza e rientro'
                })()}
              </div>

              <small>
                Il numero di giornate viene calcolato automaticamente dalle date del viaggio.
              </small>
            </div>

            <div className="trip-settings-field">
              <label>
                Tipo di percorso
              </label>

              <div className="trip-settings-choice-grid trip-shape-grid">
                {(
                  [
                    'one-way',
                    'round-trip',
                    'loop',
                  ] as const
                ).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        draft.shape ===
                        value
                          ? 'trip-choice active'
                          : 'trip-choice'
                      }
                      onClick={() =>
                        setDraft(
                          (
                            current,
                          ) => ({
                            ...current,
                            shape:
                              value,
                          }),
                        )
                      }
                    >
                      {
                        tripShapeLabels[
                          value
                        ]
                      }
                    </button>
                  ),
                )}
              </div>

              <small>
                Per ora questa scelta viene
                registrata nel viaggio. La
                generazione automatica di
                ritorno e anello verrà collegata
                nella fase successiva.
              </small>
            </div>
          </section>

          <section className="trip-settings-section">
            <h3>
              Date viaggio
            </h3>

            <div className="trip-settings-two-columns">
              <div className="trip-settings-field">
                <label>
                  Partenza
                </label>

                <input
                  type="date"
                  value={
                    draft.departureDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setDraft(
                      (
                        current,
                      ) =>
                        withDerivedDuration({
                          ...current,
                          departureDate:
                            event
                              .target
                              .value,
                        }),
                    )
                  }
                />
              </div>

              <div className="trip-settings-field">
                <label>
                  Rientro / fine viaggio
                </label>

                <input
                  type="date"
                  min={
                    draft.departureDate ||
                    undefined
                  }
                  value={
                    draft.returnDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setDraft(
                      (
                        current,
                      ) =>
                        withDerivedDuration({
                          ...current,
                          returnDate:
                            event
                              .target
                              .value,
                        }),
                    )
                  }
                />
              </div>
            </div>

            <div className="trip-settings-field">
              <label>
                Ora di partenza
              </label>

              <input
                type="time"
                value={
                  draft.departureTime
                }
                onChange={(
                  event,
                ) =>
                  setDraft(
                    (
                      current,
                    ) => ({
                      ...current,
                      departureTime:
                        event
                          .target
                          .value,
                    }),
                  )
                }
              />
            </div>

            <small className="trip-settings-note">
              Le date vengono assegnate automaticamente alle giornate e ai pernottamenti.
            </small>
          </section>

          <section className="trip-settings-section">
            <h3>
              Stile percorso
            </h3>

            <div className="route-style-list">
              {(
                [
                  'fast',
                  'scenic',
                  'mixed',
                  'curvy',
                  'relax',
                ] as const
              ).map(
                (value) => {
                  const available =
                    value ===
                    'fast'

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={
                        !available
                      }
                      className={
                        draft.routeStyle ===
                        value
                          ? 'route-style-choice active'
                          : 'route-style-choice'
                      }
                      onClick={() =>
                        available &&
                        setDraft(
                          (
                            current,
                          ) => ({
                            ...current,
                            routeStyle:
                              value,
                          }),
                        )
                      }
                    >
                      <span>
                        {
                          routeStyleLabels[
                            value
                          ]
                        }
                      </span>

                      <small>
                        {available
                          ? 'Disponibile'
                          : 'Prossimamente'}
                      </small>
                    </button>
                  )
                },
              )}
            </div>

            <p className="trip-settings-warning">
              Il motore attuale OSRM supporta
              realmente soltanto il profilo
              Veloce. Gli altri profili sono
              già previsti nel modello dati ma
              non vengono simulati.
            </p>
          </section>

          <section className="trip-settings-section">
            <h3>
              Preferenze stradali
            </h3>

            <label className="road-preference-row">
              <div className="road-preference-text">
                <strong>
                  Evita autostrade
                </strong>
                <small>
                  Devia su strade statali,
                  provinciali e passi panoramici
                </small>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .roadPreferences
                    .avoidMotorways
                }
                onChange={(
                  event,
                ) =>
                  updateRoadPreference(
                    'avoidMotorways',
                    event.target
                      .checked,
                  )
                }
              />
            </label>

            <label className="road-preference-row">
              <div className="road-preference-text">
                <strong>
                  Evita pedaggi
                </strong>
                <small>
                  Esclude caselli, tunnel a
                  pagamento e vignette
                </small>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .roadPreferences
                    .avoidTolls
                }
                onChange={(
                  event,
                ) =>
                  updateRoadPreference(
                    'avoidTolls',
                    event.target
                      .checked,
                  )
                }
              />
            </label>

            <label className="road-preference-row">
              <div className="road-preference-text">
                <strong>
                  Evita sterrato
                </strong>
                <small>
                  Evita percorsi con fondo
                  stradale non asfaltato
                </small>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .roadPreferences
                    .avoidUnpaved
                }
                onChange={(
                  event,
                ) =>
                  updateRoadPreference(
                    'avoidUnpaved',
                    event.target
                      .checked,
                  )
                }
              />
            </label>

            <label className="road-preference-row">
              <div className="road-preference-text">
                <strong>
                  Evita strade particolarmente strette
                </strong>
                <small>
                  Privilegia carreggiate ampie
                  e scorrevoli per moto da viaggio
                </small>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .roadPreferences
                    .avoidNarrowRoads
                }
                onChange={(
                  event,
                ) =>
                  updateRoadPreference(
                    'avoidNarrowRoads',
                    event.target
                      .checked,
                  )
                }
              />
            </label>

            <label className="road-preference-row">
              <div className="road-preference-text">
                <strong>
                  Evita centri urbani quando possibile
                </strong>
                <small>
                  Instrada su tangenziali esterne
                  e circonvallazioni
                </small>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .roadPreferences
                    .avoidUrbanAreas
                }
                onChange={(
                  event,
                ) =>
                  updateRoadPreference(
                    'avoidUrbanAreas',
                    event.target
                      .checked,
                  )
                }
              />
            </label>

            <div className="road-preference-separator" />

            <label className="road-preference-row">
              <div className="road-preference-text">
                <strong>
                  Consenti traghetti marittimi
                </strong>
                <small>
                  Include traversate marittime
                  e ponti galleggianti
                </small>
              </div>

              <input
                type="checkbox"
                checked={
                  draft
                    .roadPreferences
                    .allowFerries
                }
                onChange={(
                  event,
                ) =>
                  updateRoadPreference(
                    'allowFerries',
                    event.target
                      .checked,
                  )
                }
              />
            </label>

            <p className="trip-settings-warning">
              Queste preferenze vengono già
              salvate nel viaggio. Saranno
              applicate realmente soltanto
              quando il relativo comportamento
              sarà supportato dal motore di
              routing.
            </p>
          </section>
        </div>

        <div className="trip-settings-footer">
          <button
            type="button"
            className="trip-settings-cancel"
            onClick={onClose}
          >
            Annulla
          </button>

          <button
            type="button"
            className="trip-settings-apply"
            onClick={() => {
              onApply(
                cloneSettings(
                  withDerivedDuration(
                    draft,
                  ),
                ),
              )

              onClose()
            }}
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  )
}
