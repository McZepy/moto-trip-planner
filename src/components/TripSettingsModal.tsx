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
                  Durata
                </label>
  
                <div className="trip-settings-choice-grid">
                  {(
                    [
                      'single-day',
                      'multi-day',
                    ] as const
                  ).map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        className={
                          draft.durationMode ===
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
  
                              durationMode:
                                value,
  
                              plannedDays:
                                value ===
                                'single-day'
                                  ? 1
                                  : current.plannedDays ??
                                    2,
                            }),
                          )
                        }
                      >
                        {
                          tripDurationLabels[
                            value
                          ]
                        }
                      </button>
                    ),
                  )}
                </div>
              </div>
  
              {draft.durationMode ===
                'multi-day' && (
                <div className="trip-settings-field">
                  <label>
                    Numero giorni previsto
                  </label>
  
                  <input
                    type="number"
                    min="2"
                    max="90"
                    value={
                      draft.plannedDays ??
                      2
                    }
                    onChange={(
                      event,
                    ) =>
                      setDraft(
                        (
                          current,
                        ) => ({
                          ...current,
  
                          plannedDays:
                            Math.max(
                              2,
  
                              Number(
                                event
                                  .target
                                  .value,
                              ) ||
                                2,
                            ),
                        }),
                      )
                    }
                  />
                </div>
              )}
  
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
                Partenza
              </h3>
  
              <div className="trip-settings-two-columns">
                <div className="trip-settings-field">
                  <label>
                    Data
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
                        ) => ({
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
                    Ora
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
              </div>
  
              <small className="trip-settings-note">
                Serviranno per timeline,
                pause, traghetti, meteo e
                controlli delle criticità.
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
  
              <label className="trip-settings-check">
                <input
                  type="checkbox"
                  checked={
                    draft
                      .roadPreferences
                      .pavedOnly
                  }
                  onChange={(
                    event,
                  ) =>
                    updateRoadPreference(
                      'pavedOnly',
                      event.target
                        .checked,
                    )
                  }
                />
  
                <span>
                  Solo strade asfaltate
                </span>
              </label>
  
              <label className="trip-settings-check">
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
  
                <span>
                  Evita sterrato
                </span>
              </label>
  
              <label className="trip-settings-check">
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
  
                <span>
                  Evita autostrade
                </span>
              </label>
  
              <label className="trip-settings-check">
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
  
                <span>
                  Evita pedaggi
                </span>
              </label>
  
              <label className="trip-settings-check">
                <input
                  type="checkbox"
                  checked={
                    draft
                      .roadPreferences
                      .avoidDifficultRoads
                  }
                  onChange={(
                    event,
                  ) =>
                    updateRoadPreference(
                      'avoidDifficultRoads',
                      event.target
                        .checked,
                    )
                  }
                />
  
                <span>
                  Evita strade molto impegnative
                </span>
              </label>
  
              <p className="trip-settings-warning">
                Anche queste preferenze vengono
                già salvate. Saranno applicate
                realmente quando collegheremo il
                motore di routing motociclistico.
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
                    draft,
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