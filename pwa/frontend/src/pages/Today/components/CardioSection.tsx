import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Chip,
  IconButton,
  TextField,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Check as CheckIcon,
  RefreshRounded as RefreshIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { DEFAULT_EXERCISES } from '../../../constants/exercises';
import { ExerciseImage } from '../../../components/ExerciseImage';
import {
  computeCardioElapsedSeconds,
  formatTimer,
} from '../../../domain/sessionTimer';
import type { Exercise, SessionExercise } from '../../../types';

export function CardioSection() {
  const activeSession = useSessionStore(state => state.activeSession);
  const cardioExercises = DEFAULT_EXERCISES.filter((e) => e.type === 'cardio');

  // 将动作库与 session 中的有氧记录配对
  const items = cardioExercises.map((exercise) => {
    const sessionExercise = activeSession?.exercises.find(
      (e) => e.exerciseId === exercise.id && e.type === 'cardio',
    );
    return { exercise, sessionExercise };
  });

  return (
    <Box>
      {items.map(({ exercise, sessionExercise }) => (
        <CardioCard
          key={exercise.id}
          exercise={exercise}
          sessionExercise={sessionExercise}
        />
      ))}
    </Box>
  );
}

interface CardioCardProps {
  exercise: Exercise;
  sessionExercise?: SessionExercise;
}

function CardioCard({ exercise, sessionExercise }: CardioCardProps) {
  const startCardio = useSessionStore(state => state.startCardio);
  const pauseCardio = useSessionStore(state => state.pauseCardio);
  const resumeCardio = useSessionStore(state => state.resumeCardio);
  const completeCardio = useSessionStore(state => state.completeCardio);

  const record = sessionExercise?.cardioRecord;
  const status = record?.status ?? 'idle';

  // 目标时长输入（分钟）
  const [targetMinutes, setTargetMinutes] = useState('30');
  // 运行中指标输入
  const [speed, setSpeed] = useState('');
  const [incline, setIncline] = useState('');

  // setInterval 仅触发 UI 重绘，有氧计时数据由时间戳实时计算
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [status, sessionExercise?.id]);

  const elapsedSeconds = record ? computeCardioElapsedSeconds(record) : 0;

  const handleStart = () => {
    const minutes = parseInt(targetMinutes, 10);
    startCardio(exercise, isNaN(minutes) || minutes <= 0 ? undefined : minutes);
  };

  const handlePause = () => {
    if (sessionExercise) pauseCardio(sessionExercise.id);
  };

  const handleResume = () => {
    if (sessionExercise) resumeCardio(sessionExercise.id);
  };

  const handleComplete = () => {
    if (!sessionExercise) return;
    completeCardio(sessionExercise.id, {
      speed: speed ? Number(speed) : undefined,
      incline: incline ? Number(incline) : undefined,
    });
  };

  const handleRestart = () => {
    startCardio(exercise, parseInt(targetMinutes, 10) || undefined);
  };

  const isActive = status === 'running' || status === 'paused';

  return (
    <Card
      data-testid={`cardio-card-${exercise.id}`}
      sx={{
        mb: 2,
        borderRadius: '12px',
        border: isActive ? '2px solid' : '1px solid',
        borderColor: isActive ? 'primary.main' : 'divider',
        boxShadow: isActive
          ? '0 14px 34px rgba(16, 185, 129, 0.14)'
          : '0 10px 28px rgba(15, 23, 42, 0.06)',
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box>
              <ExerciseImage exerciseName={exercise.name} type="cardio" size={64} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
                {exercise.name}
              </Typography>
              {status === 'running' && (
                <Chip size="small" label="进行中" sx={statusChipStyle('running')} />
              )}
              {status === 'paused' && (
                <Chip size="small" label="已暂停" sx={statusChipStyle('paused')} />
              )}
              {status === 'completed' && (
                <Chip size="small" label="已完成" sx={statusChipStyle('completed')} />
              )}
            </Box>
          </Box>
          <IconButton size="small"><MoreIcon /></IconButton>
        </Box>

        {status === 'idle' && (
          <IdleState
            targetMinutes={targetMinutes}
            onTargetChange={setTargetMinutes}
            onStart={handleStart}
          />
        )}

        {isActive && (
          <ActiveState
            elapsedSeconds={elapsedSeconds}
            targetDurationSeconds={record?.targetDurationSeconds}
            speed={speed}
            incline={incline}
            onSpeedChange={setSpeed}
            onInclineChange={setIncline}
            isRunning={status === 'running'}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleComplete}
          />
        )}

        {status === 'completed' && (
          <CompletedState
            elapsedSeconds={record?.elapsedSeconds ?? 0}
            speed={record?.speed}
            incline={record?.incline}
            onRestart={handleRestart}
          />
        )}
      </Box>
    </Card>
  );
}

function IdleState({
  targetMinutes,
  onTargetChange,
  onStart,
}: {
  targetMinutes: string;
  onTargetChange: (v: string) => void;
  onStart: () => void;
}) {
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, p: 2, bgcolor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}>
        <CardioInput label="目标时长(分钟)" value={targetMinutes} onChange={onTargetChange} />
      </Box>
      <Button
        data-testid="cardio-start-button"
        variant="contained"
        fullWidth
        startIcon={<PlayIcon />}
        onClick={onStart}
        sx={{ background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)' }}
      >
        开始有氧
      </Button>
    </>
  );
}

function ActiveState({
  elapsedSeconds,
  targetDurationSeconds,
  speed,
  incline,
  onSpeedChange,
  onInclineChange,
  isRunning,
  onPause,
  onResume,
  onComplete,
}: {
  elapsedSeconds: number;
  targetDurationSeconds?: number;
  speed: string;
  incline: string;
  onSpeedChange: (v: string) => void;
  onInclineChange: (v: string) => void;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}) {
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, p: 2, bgcolor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}>
        <MetricDisplay label="实际时长" value={formatTimer(elapsedSeconds)} />
        <MetricDisplay
          label="目标时长"
          value={targetDurationSeconds ? `${Math.round(targetDurationSeconds / 60)} 分钟` : '未设定'}
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
        <CardioInput label="速度(km/h)" value={speed} onChange={onSpeedChange} />
        <CardioInput label="坡度" value={incline} onChange={onInclineChange} />
      </Box>
      <Box sx={{ display: 'flex', gap: 2 }}>
        {isRunning ? (
          <Button
            data-testid="cardio-pause-button"
            variant="outlined"
            fullWidth
            startIcon={<PauseIcon />}
            onClick={onPause}
            color="warning"
          >
            暂停
          </Button>
        ) : (
          <Button
            data-testid="cardio-resume-button"
            variant="outlined"
            fullWidth
            startIcon={<PlayIcon />}
            onClick={onResume}
            color="primary"
          >
            继续
          </Button>
        )}
        <Button
          data-testid="cardio-complete-button"
          variant="contained"
          fullWidth
          startIcon={<CheckIcon />}
          onClick={onComplete}
        >
          完成记录
        </Button>
      </Box>
    </>
  );
}

function CompletedState({
  elapsedSeconds,
  speed,
  incline,
  onRestart,
}: {
  elapsedSeconds: number;
  speed?: number;
  incline?: number;
  onRestart: () => void;
}) {
  return (
    <>
      <Box sx={{ p: 2, bgcolor: 'rgba(5, 169, 120, 0.05)', borderRadius: '12px', mb: 2 }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#078c66' }}>
          已完成 {formatTimer(elapsedSeconds)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {speed ? `${speed} km/h` : ''}
          {speed && incline ? ' · ' : ''}
          {incline ? `坡度 ${incline}` : ''}
          {!speed && !incline ? '无额外指标' : ''}
        </Typography>
      </Box>
      <Button
        data-testid="cardio-restart-button"
        variant="outlined"
        fullWidth
        startIcon={<RefreshIcon />}
        onClick={onRestart}
      >
        再次记录
      </Button>
    </>
  );
}

function MetricDisplay({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

function CardioInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>{label}</Typography>
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: 80, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'background.paper' } }}
        inputProps={{ style: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' } }}
      />
    </Box>
  );
}

function statusChipStyle(status: 'running' | 'paused' | 'completed') {
  const styles = {
    running: { height: 20, bgcolor: 'rgba(16, 185, 129, 0.1)', color: 'primary.main', fontWeight: 600, fontSize: '0.7rem' },
    paused: { height: 20, bgcolor: 'rgba(245, 158, 11, 0.1)', color: 'warning.main', fontWeight: 600, fontSize: '0.7rem' },
    completed: { height: 20, bgcolor: 'rgba(5, 169, 120, 0.1)', color: '#078c66', fontWeight: 600, fontSize: '0.7rem' },
  };
  return styles[status];
}
