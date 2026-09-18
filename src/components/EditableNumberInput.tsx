import {
  useEffect,
  useState,
} from 'react'

type EditableNumberInputProps = {
  value:
    | number
    | null
    | undefined

  min?:
    number

  max?:
    number

  step?:
    number

  placeholder?:
    string

  disabled?:
    boolean

  allowEmpty?:
    boolean

  fallback?:
    number

  onCommit:
    (
      value:
        number | null,
    ) => void
}

function clamp(
  value:
    number,
  min?:
    number,
  max?:
    number,
) {
  let next =
    value

  if (
    min !==
    undefined
  ) {
    next =
      Math.max(
        min,
        next,
      )
  }

  if (
    max !==
    undefined
  ) {
    next =
      Math.min(
        max,
        next,
      )
  }

  return next
}

export function EditableNumberInput({
  value,
  min,
  max,
  step,
  placeholder,
  disabled,
  allowEmpty =
    false,
  fallback,
  onCommit,
}: EditableNumberInputProps) {
  const [
    draft,
    setDraft,
  ] =
    useState(
      value ===
          null ||
        value ===
          undefined
        ? ''
        : String(
            value,
          ),
    )

  useEffect(
    () => {
      setDraft(
        value ===
            null ||
          value ===
            undefined
          ? ''
          : String(
              value,
            ),
      )
    },
    [
      value,
    ],
  )

  const commit =
    () => {
      const clean =
        draft.trim()

      if (
        clean ===
        ''
      ) {
        if (
          allowEmpty
        ) {
          onCommit(
            null,
          )

          setDraft(
            '',
          )

          return
        }

        const restored =
          value ??
          fallback ??
          min ??
          1

        setDraft(
          String(
            restored,
          ),
        )

        return
      }

      const parsed =
        Number(
          clean.replace(
            ',',
            '.',
          ),
        )

      if (
        !Number.isFinite(
          parsed,
        )
      ) {
        const restored =
          value ??
          fallback ??
          min ??
          1

        setDraft(
          String(
            restored,
          ),
        )

        return
      }

      const safeMin =
        min ??
        0.000001

      const next =
        clamp(
          parsed <=
            0
            ? safeMin
            : parsed,
          min,
          max,
        )

      onCommit(
        next,
      )

      setDraft(
        String(
          next,
        ),
      )
    }

  return (
    <input
      type="number"
      min={
        min
      }
      max={
        max
      }
      step={
        step
      }
      placeholder={
        placeholder
      }
      disabled={
        disabled
      }
      value={
        draft
      }
      onFocus={(
        event,
      ) =>
        event
          .currentTarget
          .select()
      }
      onChange={(
        event,
      ) =>
        setDraft(
          event
            .target
            .value,
        )
      }
      onBlur={
        commit
      }
      onKeyDown={(
        event,
      ) => {
        if (
          event.key ===
          'Enter'
        ) {
          event
            .currentTarget
            .blur()
        }

        if (
          event.key ===
          'Escape'
        ) {
          setDraft(
            value ===
                null ||
              value ===
                undefined
              ? ''
              : String(
                  value,
                ),
          )

          event
            .currentTarget
            .blur()
        }
      }}
    />
  )
}
