import {
  autocompletePlaces,
  isLocationIqConfigured,
  type AutocompleteSuggestion,
  type PortResultGroup,
} from '../providers/autocompleteProvider'

const input =
  document.querySelector<HTMLInputElement>(
    '#query',
  )

const results =
  document.querySelector<HTMLDivElement>(
    '#results',
  )

const status =
  document.querySelector<HTMLDivElement>(
    '#status',
  )

const quickButtons =
  document.querySelectorAll<HTMLButtonElement>(
    '[data-query]',
  )

if (
  !input ||
  !results ||
  !status
) {
  throw new Error(
    'Pagina test non valida.',
  )
}

let timer:
  number | null =
    null

let controller:
  AbortController | null =
    null

status.textContent =
  isLocationIqConfigured()
    ? 'LocationIQ: configurata. In attesa.'
    : 'LocationIQ: chiave non visibile a Vite.'

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&#039;',
    )
}

function kindLabel(
  suggestion:
    AutocompleteSuggestion,
) {
  if (
    suggestion.kind ===
    'ferry-terminal'
  ) {
    return 'TERMINAL TRAGHETTI'
  }

  if (
    suggestion.kind ===
    'place'
  ) {
    return 'LOCALITÀ'
  }

  if (
    suggestion.kind ===
    'address'
  ) {
    return 'INDIRIZZO'
  }

  return 'POI'
}

function renderCard(
  suggestion:
    AutocompleteSuggestion,
) {
  return `
    <div class="result">
      <span class="badge ${
        suggestion.kind ===
        'ferry-terminal'
          ? 'ferry'
          : ''
      }">
        ${kindLabel(
          suggestion,
        )}
      </span>

      <strong>
        ${escapeHtml(
          suggestion.name,
        )}
      </strong>

      <small>
        ${escapeHtml(
          suggestion.label,
        )}
      </small>

      <small class="coordinates">
        ${suggestion.lat.toFixed(5)},
        ${suggestion.lng.toFixed(5)}
      </small>

      <small class="source">
        Fonte:
        ${suggestion.source}
      </small>
    </div>
  `
}

function groupTitle(
  group:
    PortResultGroup,
) {
  if (
    group ===
    'recommended'
  ) {
    return 'ACCESSO CONSIGLIATO'
  }

  if (
    group ===
    'company-terminal'
  ) {
    return 'TERMINAL COMPAGNIE'
  }

  return 'ALTRI PUNTI DEL PORTO'
}

function render(
  suggestions:
    AutocompleteSuggestion[],
) {
  if (
    suggestions.length ===
    0
  ) {
    results.innerHTML =
      '<div class="empty">Nessun suggerimento.</div>'

    return
  }

  const isPortSearch =
    suggestions.some(
      (
        suggestion,
      ) =>
        Boolean(
          suggestion.portGroup,
        ),
    )

  if (!isPortSearch) {
    results.innerHTML =
      suggestions
        .map(
          renderCard,
        )
        .join('')

    return
  }

  const groups:
    PortResultGroup[] = [
      'recommended',
      'company-terminal',
      'other-port',
    ]

  results.innerHTML =
    groups
      .map(
        (
          group,
        ) => {
          const items =
            suggestions.filter(
              (
                suggestion,
              ) =>
                suggestion.portGroup ===
                group,
            )

          if (
            items.length ===
            0
          ) {
            return ''
          }

          return `
            <section class="group">
              <h2>
                ${groupTitle(
                  group,
                )}
              </h2>

              <div class="group-list">
                ${items
                  .map(
                    renderCard,
                  )
                  .join('')}
              </div>
            </section>
          `
        },
      )
      .join('')
}

async function runSearch(
  value: string,
) {
  controller?.abort()

  const query =
    value.trim()

  if (
    query.length <
    3
  ) {
    status.textContent =
      'Scrivi almeno 3 caratteri.'

    results.innerHTML =
      ''

    return
  }

  controller =
    new AbortController()

  status.textContent =
    'Ricerca intelligente...'

  try {
    const suggestions =
      await autocompletePlaces(
        query,
        controller.signal,
      )

    status.textContent =
      `${suggestions.length} suggerimenti`

    render(
      suggestions,
    )
  } catch (
    error
  ) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        'AbortError'
    ) {
      return
    }

    console.error(
      error,
    )

    status.textContent =
      error instanceof Error
        ? error.message
        : 'Errore ricerca.'

    results.innerHTML =
      '<div class="error">Ricerca non disponibile.</div>'
  }
}

input.addEventListener(
  'input',
  () => {
    if (
      timer !==
      null
    ) {
      window.clearTimeout(
        timer,
      )
    }

    timer =
      window.setTimeout(
        () => {
          runSearch(
            input.value,
          )
        },
        220,
      )
  },
)

quickButtons.forEach(
  (
    button,
  ) => {
    button.addEventListener(
      'click',
      () => {
        const query =
          button.dataset
            .query ??
          ''

        input.value =
          query

        if (
          timer !==
          null
        ) {
          window.clearTimeout(
            timer,
          )
        }

        runSearch(
          query,
        )
      },
    )
  },
)
