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
import {
  EQUIPMENT_METRICS,
  validateMetric,
  parseMetricInput,
  metricToInputDisplay,
  type MetricField,
} from '../../../domain/cardioMetrics';
import type { Exercise, SessionExercise, CardioRecord } from '../../../types';

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
  const flushPendingWrites = useSessionStore(state => state.flushPendingWrites);

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

  // 页面隐藏前 flush 未提交的草稿 + 立即持久化（避免切换页签/刷新丢失输入）
  useEffect(() => {
    const handler = () => {
      // 1. 同步提交所有 CardioDraftInput 草稿到 store
      window.dispatchEvent(new Event('cardio-flush-drafts'));
      // 2. 取消防抖并立即写库（pagehide 时浏览器会等待 pending IDB 事务完成）
      void flushPendingWrites();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handler();
    };
    window.addEventListener('pagehide', handler);
    window.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [flushPendingWrites]);

  const elapsedSeconds = record ? computeCardioElapsedSeconds(record) : 0;

  // 将存储值转换为输入框展示字符串（如 distanceMeters → km）
  const getMetricDisplay = (field: MetricField): string =>
    metricToInputDisplay(field, record?.[field.key]);

  // 将输入框字符串解析并换算为存储值，写入 store
  const commitMetric = (field: MetricField, input: string) => {
    if (!sessionExercise) return;
    const stored = parseMetricInput(field, input);
    // null 表示 NaN 中间态，不写入；undefined 表示清空，写入 undefined
    if (stored === null) return;
    updateCardioMetrics(sessionExercise.id, { [field.key]: stored });
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
    // 完成前先提交所有未提交的输入草稿到 store（确保最新指标被保存）
    window.dispatchEvent(new Event('cardio-flush-drafts'));
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
            getMetricDisplay={getMetricDisplay}
            onCommit={commitMetric}
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
  getMetricDisplay,
  onCommit,
  isRunning,
  onPause,
  onResume,
  onComplete,
}: {
  elapsedSeconds: number;
  targetDurationSeconds?: number;
  metricFields: MetricField[];
  getMetricDisplay: (field: MetricField) => string;
  onCommit: (field: MetricField, input: string) => void;
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

      {/* 器械特定指标输入：草稿保存在组件本地，onBlur/Enter 提交到 store */}
      {metricFields.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          {metricFields.map((field) => {
            const displayValue = getMetricDisplay(field);
            // 校验基于存储值：将显示值（km）转回米
            const storedForValidation = (() => {
              if (displayValue === '' || Number.isNaN(Number(displayValue))) return undefined;
              const inputNum = Number(displayValue);
              return field.toStored ? field.toStored(inputNum) : inputNum;
            })();
            const warning = validateMetric(field.key, storedForValidation);
            return (
              <CardioDraftInput
                key={field.key}
                label={`${field.label}${field.inputUnit ? `(${field.inputUnit})` : ''}`}
                initialValue={displayValue}
                onCommit={(v) => onCommit(field, v)}
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
              const stored = record?.[field.key];
              if (stored === undefined || stored === null || typeof stored !== 'number') return null;
              const display = field.toDisplay ? field.toDisplay(stored) : `${stored}${field.inputUnit ? ` ${field.inputUnit}` : ''}`;
              return (
                <Typography key={field.key} variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                  {field.label}: <strong>{display}</strong>
                </Typography>
              );
            })}
            {metricFields.every((f) => record?.[f.key] === undefined) && (
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

/**
 * 草稿输入框：
 * - onChange 仅更新本地字符串草稿，不写入 store
 * - onBlur / Enter 提交到 store
 * - 监听全局 cardio-flush-drafts 事件，在页签切换/刷新前 flush
 * - NaN 不会进入 store
 */
function CardioDraftInput({
  label,
  initialValue,
  onCommit,
  warning,
}: {
  label: string;
  initialValue: string;
  onCommit: (v: string) => void;
  warning?: string | null;
}) {
  const [draft, setDraft] = useState(initialValue);

  // 当 store 中存储值变化（如恢复未完成训练）时同步草稿
  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  // 页签切换/刷新前 flush 未提交草稿
  useEffect(() => {
    const flush = () => {
      if (draft !== initialValue) {
        onCommit(draft);
      }
    };
    window.addEventListener('cardio-flush-drafts', flush);
    return () => {
      window.removeEventListener('cardio-flush-drafts', flush);
    };
  }, [draft, initialValue, onCommit]);

  const commit = () => onCommit(draft);

  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>{label}</Typography>
      <TextField
        size="small"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
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

/** 简单输入框（用于目标时长等非指标场景，直接受控） */
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
