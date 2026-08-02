type WorkoutIconName = 'strength' | 'cardio' | 'today' | 'plans' | 'history' | 'settings' | 'timer' | 'finish';

interface WorkoutIconProps {
  name: WorkoutIconName;
  size?: number;
  strokeWidth?: number;
}

function strokeProps(strokeWidth = 3.2) {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

// UI 导航、Tab、计时器等通用图标（非动作插画）
export function WorkoutIcon({ name, size = 24, strokeWidth = 2.5 }: WorkoutIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <g {...strokeProps(strokeWidth)}>
        {name === 'strength' && <path d="M3 12h18M5 8v8M19 8v8M8 10v4M16 10v4" />}
        {name === 'cardio' && <path d="M12 6v6l4 2M5 5l-2 2M19 5l2 2M5.5 18a9 9 0 1 0 13 0" />}
        {name === 'today' && <path d="M3 12h18M5 8v8M19 8v8M8 10v4M16 10v4" />}
        {name === 'plans' && <path d="M7 3v4M17 3v4M4 8h16M6 12h5M6 16h8M5 5h14v15H5z" />}
        {name === 'history' && <path d="M4 12a8 8 0 1 0 3-6.25M4 4v5h5M12 8v5l3 2" />}
        {name === 'settings' && <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />}
        {name === 'timer' && <path d="M12 7v5l3 2M9 2h6M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" />}
        {name === 'finish' && <path d="M5 21V4M5 5h11l-2 4 2 4H5M15 17l2 2 4-5" />}
      </g>
    </svg>
  );
}
