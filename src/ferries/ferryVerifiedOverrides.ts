import type {
  FerryService,
} from './ferryCatalogTypes'

export type FerryServiceVerifiedOverride = {
  durationMinutesMin?: number
  durationMinutesMax?: number

  checkedAt: string
  source: string
  reference: string
}

export type FerryResolvedTiming = {
  durationMinutesMin: number
  durationMinutesMax: number

  /*
   * Finché non abbiamo data e orario reali,
   * il confronto usa prudenzialmente la
   * durata massima verificata.
   */
  comparisonMinutes: number

  basis:
    | 'exact'
    | 'conservative-max'

  overrideSource?: string
  overrideReference?: string
  overrideCheckedAt?: string
}

/*
 * Correzioni/verifiche manuali isolate dai motori.
 *
 * Questo file NON deve diventare un catalogo parallelo.
 * Serve solo per dati verificati che il seed/importatore
 * non contiene ancora. In futuro questi valori potranno
 * essere assorbiti dal processo automatico di importazione.
 */
const VERIFIED_SERVICE_OVERRIDES:
  Record<
    string,
    FerryServiceVerifiedOverride
  > = {
  'color-hirtshals-larvik': {
    durationMinutesMin:
      225,
    durationMinutesMax:
      225,

    checkedAt:
      '2026-09-17',

    source:
      'Color Line',

    reference:
      'https://www.colorline.com/denmark-norway/ferry-hirtshals-larvik',
  },
}

export function resolveFerryServiceTiming(
  service: FerryService,
): FerryResolvedTiming | null {
  const override =
    VERIFIED_SERVICE_OVERRIDES[
      service.id
    ]

  const durationMinutesMin =
    override
      ?.durationMinutesMin ??
    service
      .durationMinutesMin ??
    service
      .durationMinutesMax

  const durationMinutesMax =
    override
      ?.durationMinutesMax ??
    service
      .durationMinutesMax ??
    service
      .durationMinutesMin

  if (
    durationMinutesMin ===
      undefined ||
    durationMinutesMax ===
      undefined
  ) {
    return null
  }

  return {
    durationMinutesMin,
    durationMinutesMax,

    comparisonMinutes:
      durationMinutesMax,

    basis:
      durationMinutesMin ===
      durationMinutesMax
        ? 'exact'
        : 'conservative-max',

    overrideSource:
      override?.source,

    overrideReference:
      override?.reference,

    overrideCheckedAt:
      override?.checkedAt,
  }
}
