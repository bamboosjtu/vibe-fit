import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormHelperText,
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

/**
 * 指标合理性校验规则（非阻塞，仅提示异常值）。
 * 不阻止保存，但用户输入超出合理范围时给出非阻塞提示。
 */
interface ValidationRule {
  min: number;
  max: number;
  /** 异常时提示文案 */
  hint: string;
}

const METRIC_VALIDATION: Partial<Record<MetricField['key'], ValidationRule>> = {
  speed: { min: 0, max: 30, hint: '速度通常在 0-30 km/h 之间' },
  incline: { min: 0, max: 30, hint: '坡度通常在 0-30% 之间' },
  distance: { min: 0, max: 100, hint: '距离不能为负数，单次训练通常不超过 100' },
  calories: { min: 0, max: 5000, hint: '卡路里应为非负数' },
  pace: { min: 60, max: 600, hint: '配速通常在 60-600 秒/500m 之间' },
  resistance: { min: 1, max: 30, hint: '阻力等级通常在 1-30 之间' },
};

/** 校验单个指标值：返回异常提示文案，正常时返回 null */
function validateMetric(key: MetricField['key'], value: number | undefined | null): string | null {
  if (value === undefined || value === null || Number.isNaN(value)) return null;
  const rule = METRIC_VALIDATION[key];
  if (!rule) return null;
  if (value < rule.min || value > rule.max) return rule.hint;
  return null;
}

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
  const updateCardioMetrics = useSessionStore(state => state.updateCardioMetrics);

  const record = sessionExercise?.cardioRecord;
  const status = record?.status ?? 'idle';
  const metricFields = EQUIPMENT_METRICS[exercise.id] ?? [];

  // 目标时长输入（分钟）
  const [targetMinutes, setTargetMinutes] = useState('30');
  // "再次记录"覆盖确认：完成状态下点击再次记录需显式确认，避免误覆盖
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  // setInterval 仅触发 UI 重绘，有氧计时数据由时间戳实时计算
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [status, sessionExercise?.id]);

  const elapsedSeconds = record ? computeCardioElapsedSeconds(record) : 0;

  // 指标值统一从 store 读取（record 中），不再使用组件本地 state
  // 临时输入框值通过 onBlur/onKeyDown Enter 提交到 store
  const getMetricValue = (key: string): string => {
    const v = record?.[key as keyof CardioRecord];
    return v !== undefined && v !== null && typeof v === 'number' ? String(v) : '';
  };

  const handleMetricChange = (key: string, v: string) => {
    if (!sessionExercise) return;
    const num = v === '' ? undefined : Number(v);
    const metrics = { [key]: num } as Partial<Pick<CardioRecord, 'speed' | 'incline' | 'distance' | 'calories' | 'pace' | 'resistance' | 'rpe'>>;
    updateCardioMetrics(sessionExercise.id, metrics);
  };

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
    // 完成时无需再传 metrics：所有运行中输入已通过 updateCardioMetrics 同步到 store
    completeCardio(sessionExercise.id);
  };

  const handleRestart = () => {
    // 完成状态下再次记录会覆盖现有记录，需显式确认
    setShowRestartConfirm(true);
  };

  const confirmRestart = () => {
    setShowRestartConfirm(false);
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
            getMetricValue={getMetricValue}
            onMetricChange={handleMetricChange}
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

      {/* 再次记录覆盖确认：避免误覆盖已完成的有氧记录 */}
      <Dialog open={showRestartConfirm} onClose={() => setShowRestartConfirm(false)}>
        <DialogTitle>覆盖已完成记录？</DialogTitle>
        <DialogContent>
          <Typography>
            再次记录会覆盖当前已完成的有氧数据（时长与指标将被重置）。确定继续吗？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRestartConfirm(false)}>取消</Button>
          <Button data-testid="cardio-restart-confirm-button" color="warning" onClick={confirmRestart}>
            覆盖并重新开始
          </Button>
        </DialogActions>
      </Dialog>
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
  getMetricValue,
  onMetricChange,
  isRunning,
  onPause,
  onResume,
  onComplete,
}: {
  elapsedSeconds: number;
  targetDurationSeconds?: number;
  metricFields: MetricField[];
  getMetricValue: (key: string) => string;
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

      {/* 器械特定指标输入：值直接从 store 读取，避免切换页签/刷新丢失 */}
      {metricFields.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          {metricFields.map((field) => {
            const numericValue = getMetricValue(field.key);
            const num = numericValue === '' ? undefined : Number(numericValue);
            const warning = validateMetric(field.key, num);
            return (
              <CardioInput
                key={field.key}
                label={`${field.label}${field.unit ? `(${field.unit})` : ''}`}
                value={numericValue}
                onChange={(v) => onMetricChange(field.key, v)}
                warning={warning}
              />
            );
          })}
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

function CardioInput({ label, value, onChange, warning }: { label: string; value: string; onChange: (v: string) => void; warning?: string | null }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>{label}</Typography>
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="number"
        inputMode="decimal"
        error={Boolean(warning)}
        sx={{ width: '100%', maxWidth: 120, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'background.paper' } }}
        inputProps={{ style: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' } }}
      />
      {warning && (
        <FormHelperText sx={{ color: 'warning.main', fontSize: '0.65rem', mt: 0.25, lineHeight: 1.2 }}>
          {warning}
        </FormHelperText>
      )}
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
