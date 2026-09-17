import type {
  TripDay,
  TripDayStep,
} from '../types/tripDay'

export type ItineraryTextParseResult = {
  days: TripDay[]
  warnings: string[]
}

export type TripDayFerryLeg = {
  from: string
  to: string
  label: string
}

type PendingDay = {
  dayNumber: number
  dateLabel: string
  lines: string[]
}

function cleanMarkdown(
  value: string,
) {
  return value
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .replace(/^\s*[-*+]\s+/, '')
    .trim()
}

function cleanRouteToken(
  value: string,
) {
  return cleanMarkdown(value)
    .replace(/^\s*[,:;]+/, '')
    .replace(/[,:;]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isFerryToken(
  value: string,
) {
  const normalized =
    value
      .trim()
      .toLowerCase()

  return (
    normalized === 'traghetto' ||
    normalized === 'ferry'
  )
}

function createDayId(
  dayNumber: number,
  dateLabel: string,
) {
  return `day-${dayNumber}-${dateLabel.replace(/[^0-9]/g, '-')}`
}

function parsePendingDay(
  pending: PendingDay,
  warnings: string[],
): TripDay | null {
  const joined =
    pending.lines
      .map(cleanMarkdown)
      .filter(Boolean)
      .join(' ')

  if (!joined) {
    warnings.push(
      `Giorno ${pending.dayNumber} (${pending.dateLabel}): percorso mancante.`,
    )

    return null
  }

  const notes: string[] = []

  const routeText =
    joined.replace(
      /\(([^)]+)\)/g,
      (_match, note: string) => {
        const cleanNote =
          cleanRouteToken(note)

        if (cleanNote) {
          notes.push(cleanNote)
        }

        return ' '
      },
    )

  const rawTokens =
    routeText
      .split(/\s*(?:→|->|=>|⟶|➜)\s*/g)
      .map(cleanRouteToken)
      .filter(Boolean)

  const steps: TripDayStep[] =
    rawTokens.map((token) =>
      isFerryToken(token)
        ? {
            kind: 'ferry' as const,
            label: 'traghetto',
          }
        : {
            kind: 'place' as const,
            name: token,
          },
    )

  const placeCount =
    steps.filter(
      (step) =>
        step.kind === 'place',
    ).length

  if (placeCount < 2) {
    warnings.push(
      `Giorno ${pending.dayNumber} (${pending.dateLabel}): servono almeno partenza e arrivo.`,
    )

    return null
  }

  steps.forEach(
    (step, index) => {
      if (step.kind !== 'ferry') {
        return
      }

      const previous =
        [...steps]
          .slice(0, index)
          .reverse()
          .find(
            (candidate) =>
              candidate.kind === 'place',
          )

      const next =
        steps
          .slice(index + 1)
          .find(
            (candidate) =>
              candidate.kind === 'place',
          )

      if (!previous || !next) {
        warnings.push(
          `Giorno ${pending.dayNumber} (${pending.dateLabel}): indicazione traghetto senza porto prima o dopo.`,
        )
      }
    },
  )

  return {
    id:
      createDayId(
        pending.dayNumber,
        pending.dateLabel,
      ),
    dayNumber:
      pending.dayNumber,
    dateLabel:
      pending.dateLabel,
    steps,
    notes,
  }
}

export function parseItineraryText(
  input: string,
): ItineraryTextParseResult {
  const warnings: string[] = []
  const days: TripDay[] = []

  const lines =
    input
      .replace(/\r\n?/g, '\n')
      .split('\n')

  let pending: PendingDay | null =
    null

  const flushPending =
    () => {
      if (!pending) {
        return
      }

      const parsed =
        parsePendingDay(
          pending,
          warnings,
        )

      if (parsed) {
        days.push(parsed)
      }

      pending = null
    }

  for (const rawLine of lines) {
    const line =
      cleanMarkdown(rawLine)

    if (!line) {
      continue
    }

    const headerMatch =
      line.match(
        /^(?:(\d+)\s*[.)-]\s*)?(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?:\s+(.*))?$/,
      )

    if (headerMatch) {
      flushPending()

      const explicitNumber =
        headerMatch[1]
          ? Number(headerMatch[1])
          : days.length + 1

      pending = {
        dayNumber:
          Number.isFinite(
            explicitNumber,
          )
            ? explicitNumber
            : days.length + 1,
        dateLabel:
          headerMatch[2] as string,
        lines:
          headerMatch[3]
            ? [
                headerMatch[3],
              ]
            : [],
      }

      continue
    }

    if (!pending) {
      warnings.push(
        `Testo ignorato prima della prima data: "${line}".`,
      )
      continue
    }

    pending.lines.push(line)
  }

  flushPending()

  if (days.length === 0) {
    warnings.push(
      'Nessuna giornata riconosciuta. Usa una data come 24/7 o 24/07/2027 prima del percorso.',
    )
  }

  return {
    days,
    warnings,
  }
}

export function getTripDayPlaces(
  day: TripDay,
) {
  return day.steps
    .filter(
      (
        step,
      ): step is Extract<
        TripDayStep,
        { kind: 'place' }
      > =>
        step.kind === 'place',
    )
    .map(
      (step) =>
        step.name,
    )
}

export function getTripDayFerryLegs(
  day: TripDay,
): TripDayFerryLeg[] {
  const legs:
    TripDayFerryLeg[] = []

  day.steps.forEach(
    (step, index) => {
      if (step.kind !== 'ferry') {
        return
      }

      const previous =
        [...day.steps]
          .slice(0, index)
          .reverse()
          .find(
            (
              candidate,
            ): candidate is Extract<
              TripDayStep,
              { kind: 'place' }
            > =>
              candidate.kind === 'place',
          )

      const next =
        day.steps
          .slice(index + 1)
          .find(
            (
              candidate,
            ): candidate is Extract<
              TripDayStep,
              { kind: 'place' }
            > =>
              candidate.kind === 'place',
          )

      if (!previous || !next) {
        return
      }

      legs.push({
        from:
          previous.name,
        to:
          next.name,
        label:
          step.label,
      })
    },
  )

  return legs
}
