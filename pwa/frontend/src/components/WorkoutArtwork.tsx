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
  // 胸
  'bench-press': 'press',
  'machine-chest-press': 'press',
  'pec-deck': 'press',
  'cable-crossover': 'press',
  'cable-crossover-lower': 'press',
  'cable-crossover-decline': 'press',
  'decline-machine-press': 'press',
  'decline-press': 'press',
  'dips': 'press',
  'incline-press': 'press',
  'incline-machine-press': 'press',
  'incline-cable-crossover': 'press',

  // 背
  'pull-up': 'pull',
  'lat-pulldown': 'pull',
  'machine-pulldown': 'pull',
  'straight-arm-pulldown': 'pull',
  'barbell-row': 'row',
  't-bar-row': 'row',
  'seated-cable-row': 'row',
  'dumbbell-row': 'row',
  'rowing-machine': 'row',

  // 肩
  'shoulder-press': 'shoulders',
  'front-raise': 'shoulders',
  'lateral-raise': 'shoulders',
  'upright-row': 'shoulders',
  'rear-delt-fly': 'shoulders',
  'reverse-pec-deck': 'shoulders',
  'cable-rear-delt': 'shoulders',
  'seated-row-rear-delt': 'shoulders',

  // 手臂
  'barbell-curl': 'arms',
  'dumbbell-curl': 'arms',
  'concentration-curl': 'arms',
  'machine-curl': 'arms',
  'preacher-curl': 'arms',
  'tricep-pushdown-bar': 'arms',
  'tricep-pushdown-rope': 'arms',
  'overhead-tricep': 'arms',
  'skull-crusher': 'arms',
  'close-grip-bench': 'arms',

  // 腿臀
  'squat': 'legs',
  'leg-extension': 'legs',
  'romanian-deadlift': 'legs',
  'leg-curl': 'legs',
  'machine-hip-thrust': 'legs',
  'barbell-hip-thrust': 'legs',
  'hack-squat': 'legs',
  'leg-press': 'legs',
  'lunges': 'legs',
  'smith-squat': 'legs',

  // 腹
  'crunch': 'core',
  'hanging-leg-raise': 'core',

  // 有氧
  'treadmill': 'cardio',
  'elliptical': 'cardio',
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

function strokeProps(strokeWidth = 3.2) {
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
      <g color="#303741">
        {kind === 'press' && (
          <>
            <path {...strokeProps()} d="M14 25h68M21 25v12M75 25v12M29 60h42M34 72h28M37 60v12M65 60v12" />
            <path {...strokeProps(2.6)} d="M21 25h-8M83 25h-8M28 22v6M68 22v6" />
            <circle cx="34" cy="45" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M39 47l18 8 12 5M38 51l9 7 11-8M45 57l-8 3M58 56l8 4" />
            <path d="M42 48c5 0 9 2 12 5l-7 5-8-6Z" fill="#23b889" opacity="0.9" />
          </>
        )}
        {kind === 'pull' && (
          <>
            <path {...strokeProps()} d="M19 16h58M25 16v61M71 16v61M35 72h26M37 61h22" />
            <circle cx="48" cy="34" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M48 39v22M34 26l14 15 14-15M38 68h20M40 61l-8 11M56 61l8 11" />
            <path d="M42 42c4-3 8-3 12 0v13H42Z" fill="#23b889" opacity="0.9" />
          </>
        )}
        {kind === 'row' && (
          <>
            <path {...strokeProps()} d="M14 73h68M20 62h28M58 46h17M72 46l8 27" />
            <circle cx="31" cy="38" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M35 41l19 12 17-9M43 49l-8 14M53 54l8 18M35 63l-11 10" />
            <path d="M38 43l14 9-6 7-13-12Z" fill="#23b889" opacity="0.9" />
          </>
        )}
        {kind === 'legs' && (
          <>
            <path {...strokeProps()} d="M19 76h61M62 20v56M35 24h27M22 63h27" />
            <circle cx="40" cy="31" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M42 36l10 15 14 12M50 48L36 61M36 61l-10 15M66 63l7 13M31 24h-8M67 24h8" />
            <path d="m45 40 9 12-8 8-8-15Z" fill="#23b889" opacity="0.9" />
          </>
        )}
        {kind === 'shoulders' && (
          <>
            <path {...strokeProps()} d="M18 26h60M23 21v10M73 21v10M31 51l17-15 17 15" />
            <circle cx="48" cy="47" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M48 52v21M34 59l14-7 14 7M38 76h20" />
            <circle cx="39" cy="57" r="5" fill="#23b889" opacity="0.9" />
            <circle cx="57" cy="57" r="5" fill="#23b889" opacity="0.9" />
          </>
        )}
        {kind === 'arms' && (
          <>
            <path {...strokeProps()} d="M18 73h60M25 61h30M42 49h28" />
            <circle cx="33" cy="35" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M36 40l15 10 17-9M50 50l-8 22M57 51l10 21M67 41l8-7" />
            <path d="M46 44c5 0 8 2 10 6l-6 6-8-7Z" fill="#23b889" opacity="0.9" />
          </>
        )}
        {kind === 'core' && (
          <>
            <path {...strokeProps()} d="M17 72h64M28 61h38" />
            <circle cx="34" cy="42" r="5" fill="#303741" />
            <path {...strokeProps(3)} d="M39 44l20 8 15 18M34 48 23 70M50 50l-8 20" />
            <path d="m42 46 13 5-4 10-14-6Z" fill="#23b889" opacity="0.9" />
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
