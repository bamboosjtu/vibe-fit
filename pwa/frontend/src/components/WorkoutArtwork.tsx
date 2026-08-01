import type { ExerciseType } from '../types';

type ArtworkKind = 'press' | 'pull' | 'row' | 'legs' | 'shoulders' | 'arms' | 'core' | 'cardio' | 'strength';
type WorkoutIconName = 'strength' | 'cardio' | 'today' | 'plans' | 'history' | 'settings' | 'timer' | 'finish';

interface ExerciseArtworkProps {
  exerciseId?: string;
  exerciseName?: string;
  type?: ExerciseType;
  muscleGroups?: string[];
  size?: number;
}

interface WorkoutIconProps {
  name: WorkoutIconName;
  size?: number;
  strokeWidth?: number;
}

const exactArtworkMap: Record<string, ArtworkKind> = {
  'bench-press': 'press',
  'incline-bench-press': 'press',
  'incline-dumbbell-press': 'press',
  'dumbbell-fly': 'press',
  'chest-press-machine': 'press',
  'push-up': 'press',
  'pull-up': 'pull',
  'lat-pulldown': 'pull',
  'straight-arm-pulldown': 'pull',
  'barbell-row': 'row',
  'dumbbell-row': 'row',
  'seated-cable-row': 'row',
  'rowing-machine': 'row',
  'face-pull': 'shoulders',
  'overhead-press': 'shoulders',
  'dumbbell-shoulder-press': 'shoulders',
  'lateral-raise': 'shoulders',
  'barbell-curl': 'arms',
  'dumbbell-curl': 'arms',
  'hammer-curl': 'arms',
  'tricep-pushdown': 'arms',
  squat: 'legs',
  'leg-press': 'legs',
  'leg-extension': 'legs',
  'leg-curl': 'legs',
  'hip-thrust': 'legs',
  plank: 'core',
  crunch: 'core',
  treadmill: 'cardio',
  elliptical: 'cardio',
  'stationary-bike': 'cardio',
  'stair-climber': 'cardio',
  'jump-rope': 'cardio',
};

function inferArtworkKind({ exerciseId, exerciseName = '', type, muscleGroups = [] }: ExerciseArtworkProps): ArtworkKind {
  if (exerciseId && exactArtworkMap[exerciseId]) return exactArtworkMap[exerciseId];
  if (type === 'cardio') return 'cardio';

  const haystack = `${exerciseName} ${muscleGroups.join(' ')}`;
  if (/胸|卧推|推胸|飞鸟|俯卧撑/i.test(haystack)) return 'press';
  if (/背|下拉|引体|直臂/i.test(haystack)) return 'pull';
  if (/划船|row/i.test(haystack)) return 'row';
  if (/腿|臀|蹲|腿举|腿屈伸|腿弯举/i.test(haystack)) return 'legs';
  if (/肩|侧平举|推举|面拉/i.test(haystack)) return 'shoulders';
  if (/肱|弯举|臂屈伸|下压/i.test(haystack)) return 'arms';
  if (/核心|腹|平板/i.test(haystack)) return 'core';
  return 'strength';
}

function strokeProps(strokeWidth = 5) {
  return {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function ExerciseArtwork(props: ExerciseArtworkProps) {
  const kind = inferArtworkKind(props);
  const size = props.size ?? 72;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <rect x="4" y="4" width="88" height="88" rx="16" fill="rgba(16,185,129,0.08)" />
      <g color="#111827">
        {kind === 'press' && (
          <>
            <path {...strokeProps()} d="M16 31h64M24 31v23M72 31v23M30 59h36M34 70h28" />
            <path {...strokeProps(4)} d="M24 31h-8M80 31h-8M42 51l18 6M34 55l14-10" />
            <circle cx="35" cy="43" r="5" fill="#10B981" />
            <path {...strokeProps(4)} d="M35 48l7 10 10-4 8 10" />
          </>
        )}
        {kind === 'pull' && (
          <>
            <path {...strokeProps()} d="M24 18h48M31 18v28M65 18v28M37 48h22" />
            <circle cx="48" cy="36" r="6" fill="#10B981" />
            <path {...strokeProps(4)} d="M48 42v20M35 47l13 10 13-10M38 68h20" />
            <path {...strokeProps(3)} d="M24 74h48" />
          </>
        )}
        {kind === 'row' && (
          <>
            <path {...strokeProps()} d="M18 70h58M25 58h28M35 45h33M63 45l12 16" />
            <circle cx="34" cy="39" r="5" fill="#10B981" />
            <path {...strokeProps(4)} d="M36 44l18 10 15-12M39 57l-8 12M51 57l7 12" />
          </>
        )}
        {kind === 'legs' && (
          <>
            <path {...strokeProps()} d="M24 75h48M28 65h26M58 65h12M67 30v35M35 30h32" />
            <circle cx="42" cy="30" r="6" fill="#10B981" />
            <path {...strokeProps(4)} d="M42 36l10 17 15 12M49 50l-14 15M35 65l-8 10M67 65l6 10" />
          </>
        )}
        {kind === 'shoulders' && (
          <>
            <path {...strokeProps()} d="M20 30h56M24 30v12M72 30v12M32 54l16-14 16 14" />
            <circle cx="48" cy="48" r="6" fill="#10B981" />
            <path {...strokeProps(4)} d="M48 54v18M34 62l14-8 14 8M39 75h18" />
          </>
        )}
        {kind === 'arms' && (
          <>
            <path {...strokeProps()} d="M22 68h52M30 54h22M38 42h28" />
            <circle cx="34" cy="35" r="6" fill="#10B981" />
            <path {...strokeProps(4)} d="M36 41l14 10 16-9M50 51l-8 17M58 51l9 17" />
          </>
        )}
        {kind === 'core' && (
          <>
            <path {...strokeProps()} d="M20 70h56M31 58h34" />
            <circle cx="36" cy="43" r="6" fill="#10B981" />
            <path {...strokeProps(4)} d="M41 45l18 6 14 17M35 49l-10 19M50 52l-7 16" />
          </>
        )}
        {kind === 'cardio' && (
          <>
            <circle cx="48" cy="48" r="24" fill="rgba(16,185,129,0.14)" />
            <path {...strokeProps(5)} d="M48 25v14l11 7M29 68c8 8 27 11 40-3" />
            <path {...strokeProps(4)} d="M29 29l-7 7M67 29l7 7" />
            <circle cx="48" cy="48" r="5" fill="#10B981" />
          </>
        )}
        {kind === 'strength' && (
          <>
            <path {...strokeProps()} d="M14 48h68M22 36v24M74 36v24M31 41v14M65 41v14" />
            <circle cx="48" cy="48" r="8" fill="#10B981" />
          </>
        )}
      </g>
    </svg>
  );
}

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
