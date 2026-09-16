import type { WaypointType } from '../types/waypoint'

type WaypointTypeSelectorProps = {
  value: WaypointType
  onChange: (value: WaypointType) => void
}

export function WaypointTypeSelector({
  value,
  onChange,
}: WaypointTypeSelectorProps) {
  return (
    <div className="waypoint-type-selector">
      <button
        type="button"
        className={
          value === 'precise-stop'
            ? 'waypoint-type active'
            : 'waypoint-type'
        }
        onClick={() =>
          onChange('precise-stop')
        }
      >
        Sosta precisa
      </button>

      <button
        type="button"
        className={
          value === 'zone-pass'
            ? 'waypoint-type active'
            : 'waypoint-type'
        }
        onClick={() =>
          onChange('zone-pass')
        }
      >
        Passaggio zona
      </button>

      <button
        type="button"
        className={
          value === 'road-point'
            ? 'waypoint-type active'
            : 'waypoint-type'
        }
        onClick={() =>
          onChange('road-point')
        }
      >
        Punto strada
      </button>
    </div>
  )
}