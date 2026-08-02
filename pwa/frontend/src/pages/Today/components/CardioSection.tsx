import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Chip,
  TextField,
} from '@mui/material';
import {
  AddRounded as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Check as CheckIcon,
  RefreshRounded as RefreshIcon,
} from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { DEFAULT_EXERCISES } from '../../../constants/exercises';
import { ExerciseImage } from '../../../components/ExerciseImage';
import {
  computeCardioElapsedSeconds,
  formatTimer,
} from '../../../domain/sessionTimer';
import type { Exercise, SessionExercise, CardioRecord } from '../../../types';

/**
 * 器械指标字段配置。
 * 不同器械展示不同的指标输入，数据结构支持后续扩展。
 * 来源：docs/ui_brief/今日训练.md 第 6.3 节
 */
interface MetricField {
  key: 'speed' | 'incline' | 'distance' | 'calories' | 'rpe' | 'pace' | 'resistance';
  label: string;
  unit?: string;
}

const EQUIPMENT_METRICS: Record<string, MetricField[]> = {
  // 跑步机：时长、速度、坡度、距离、卡路里
  'treadmill': [
    { key: 'speed', label: '速度', unit: 'km/h' },
    { key: 'incline', label: '坡度', unit: '%' },
    { key: 'distance', label: '距离', unit: 'km' },
    { key: 'calories', label: '卡路里', unit: 'kcal' },
  ],
  // 椭圆机：时长、阻力等级、距离、卡路里
  'elliptical': [
    { key: 'resistance', label: '阻力等级' },
    { key: 'distance', label: '距离', unit: 'km' },
    { key: 'calories', label: '卡路里', unit: 'kcal' },
  ],
  // 划船机：时长、距离、平均配速、阻力等级
  'rowing-machine': [
    { key: 'distance', label: '距离', unit: 'm' },
    { key: 'pace', label: '平均配速', unit: '/500m' },
    { key: 'resistance', label: '阻力等级' },
  ],
};

export function CardioSection() {
  const activeSession = useSessionStore(state => state.activeSession);
  // 仅展示有图片资源占位的 3 类有氧器械
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
  const metricFields = EQUIPMENT_METRICS[exercise.id] ?? [];

  // 目标时长输入（分钟）
  const [targetMinutes, setTargetMinutes] = useState('30');
  // 运行中指标输入（动态根据器械字段）
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});

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
    // 提交指标：仅包含有值的字段
    const metrics: Partial<Pick<CardioRecord, 'speed' | 'incline' | 'distance' | 'calories' | 'rpe'>> = {};
    for (const field of metricFields) {
      const v = metricValues[field.key];
      if (v && v !== '') {
        const num = Number(v);
        if (!isNaN(num)) {
          // pace/resistance 字段不在 CardioRecord 中，跳过（数据结构扩展时再支持）
          if (field.key === 'speed' || field.key === 'incline' || field.key === 'distance' || field.key === 'calories') {
            metrics[field.key] = num;
          }
        }
      }
    }
    completeCardio(sessionExercise.id, metrics);
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
        {/* 头部：器械图片 + 名称 + 状态标签 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box>
              <ExerciseImage exerciseId={exercise.id} exerciseName={exercise.name} type="cardio" size={64} />
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
              {status === 'idle' && (
                <Chip size="small" label="未开始" sx={statusChipStyle('idle')} />
              )}
            </Box>
          </Box>
        </Box>

        {/* 四种状态分别渲染 */}
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
            metricFields={metricFields}
            metricValues={metricValues}
            onMetricChange={(key, v) => setMetricValues(prev => ({ ...prev, [key]: v }))}
            isRunning={status === 'running'}
            onPause={handlePause}
            onResume={handleResume}
            onComplete={handleComplete}
          />
        )}

        {status === 'completed' && (
          <CompletedState
            record={record}
            metricFields={metricFields}
            onRestart={handleRestart}
          />
        )}
      </Box>
    </Card>
  );
}

// ── 空闲状态 ──────────────────────────────────────────────

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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1.5,
          mb: 2,
          p: 1.5,
          bgcolor: 'rgba(16, 185, 129, 0.05)',
          borderRadius: '12px',
        }}
      >
        <CardioInput label="目标时长(分钟)" value={targetMinutes} onChange={onTargetChange} />
        <Button
          data-testid="cardio-start-button"
          variant="outlined"
          fullWidth
          startIcon={<AddIcon />}
          onClick={onStart}
          sx={{
            flex: 1,
            minHeight: 44,
            borderWidth: '1px !important',
            borderColor: 'rgba(5,169,120,0.36)',
            borderRadius: '7px',
            color: '#078c66',
            bgcolor: 'rgba(5,169,120,0.035)',
            fontSize: '0.85rem',
            fontWeight: 800,
          }}
        >
          开始有氧
        </Button>
      </Box>
    </>
  );
}

// ── 运行/暂停状态 ─────────────────────────────────────────

function ActiveState({
  elapsedSeconds,
  targetDurationSeconds,
  metricFields,
  metricValues,
  onMetricChange,
  isRunning,
  onPause,
  onResume,
  onComplete,
}: {
  elapsedSeconds: number;
  targetDurationSeconds?: number;
  metricFields: MetricField[];
  metricValues: Record<string, string>;
  onMetricChange: (key: string, v: string) => void;
  isRunning: boolean;
  onPause: () => void;
  onResume: () => void;
  onComplete: () => void;
}) {
  return (
    <>
      {/* 实际时长 + 目标时长 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, p: 2, bgcolor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}>
        <MetricDisplay label="实际时长" value={formatTimer(elapsedSeconds)} />
        <MetricDisplay
          label="目标时长"
          value={targetDurationSeconds ? `${Math.round(targetDurationSeconds / 60)} 分钟` : '未设定'}
        />
      </Box>

      {/* 器械特定指标输入 */}
      {metricFields.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          {metricFields.map((field) => (
            <CardioInput
              key={field.key}
              label={`${field.label}${field.unit ? `(${field.unit})` : ''}`}
              value={metricValues[field.key] ?? ''}
              onChange={(v) => onMetricChange(field.key, v)}
            />
          ))}
        </Box>
      )}

      {/* 控制按钮 */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {isRunning ? (
          <Button
            data-testid="cardio-pause-button"
            variant="outlined"
            fullWidth
            startIcon={<PauseIcon />}
            onClick={onPause}
            color="warning"
            sx={{ minHeight: 44 }}
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
            sx={{ minHeight: 44 }}
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
          sx={{ minHeight: 44 }}
        >
          完成记录
        </Button>
      </Box>
    </>
  );
}

// ── 完成状态 ──────────────────────────────────────────────

function CompletedState({
  record,
  metricFields,
  onRestart,
}: {
  record?: CardioRecord;
  metricFields: MetricField[];
  onRestart: () => void;
}) {
  const elapsedSeconds = record?.elapsedSeconds ?? 0;

  return (
    <>
      <Box sx={{ p: 2, bgcolor: 'rgba(5, 169, 120, 0.05)', borderRadius: '12px', mb: 2 }}>
        <Typography sx={{ fontSize: '1.4rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: '#078c66' }}>
          已完成 {formatTimer(elapsedSeconds)}
        </Typography>
        {/* 展示已保存指标 */}
        {metricFields.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {metricFields.map((field) => {
              const value = record?.[field.key as keyof CardioRecord];
              if (value === undefined || value === null || typeof value !== 'number') return null;
              return (
                <Typography key={field.key} variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                  {field.label}: <strong>{value}{field.unit ? ` ${field.unit}` : ''}</strong>
                </Typography>
              );
            })}
            {metricFields.every((f) => record?.[f.key as keyof CardioRecord] === undefined) && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                无额外指标
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <Button
        data-testid="cardio-restart-button"
        variant="outlined"
        fullWidth
        startIcon={<RefreshIcon />}
        onClick={onRestart}
        sx={{ minHeight: 44 }}
      >
        再次记录
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center', fontSize: '0.7rem' }}>
        注意：再次记录将覆盖当前已完成记录
      </Typography>
    </>
  );
}

// ── 通用子组件 ────────────────────────────────────────────

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
        type="number"
        inputMode="decimal"
        sx={{ width: '100%', maxWidth: 120, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'background.paper' } }}
        inputProps={{ style: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' } }}
      />
    </Box>
  );
}

function statusChipStyle(status: 'idle' | 'running' | 'paused' | 'completed') {
  const styles = {
    idle: { height: 20, bgcolor: 'rgba(15, 23, 42, 0.06)', color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' },
    running: { height: 20, bgcolor: 'rgba(16, 185, 129, 0.1)', color: 'primary.main', fontWeight: 600, fontSize: '0.7rem' },
    paused: { height: 20, bgcolor: 'rgba(245, 158, 11, 0.1)', color: 'warning.main', fontWeight: 600, fontSize: '0.7rem' },
    completed: { height: 20, bgcolor: 'rgba(5, 169, 120, 0.1)', color: '#078c66', fontWeight: 600, fontSize: '0.7rem' },
  };
  return styles[status];
}
