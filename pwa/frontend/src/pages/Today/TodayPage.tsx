import { useState, useEffect, useMemo, useRef } from 'react';
import { Box, Typography, Button, Paper, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { WarningRounded } from '@mui/icons-material';
import {
  Add as AddIcon,
  FitnessCenter as FitnessCenterIcon,
  PlayArrowRounded as PlayIcon,
} from '@mui/icons-material';
import { useSessionStore, usePlanStore } from '../../stores';
import { ExerciseSelector } from '../../components/ExerciseSelector';
import { WorkoutIcon } from '../../components/WorkoutArtwork';
import { TrainingHeader } from './components/TrainingHeader';
import { TrainingContextCard } from './components/TrainingContextCard';
import { StrengthSection } from './components/StrengthSection';
import { CardioSection } from './components/CardioSection';
import { SessionRecoveryDialog } from './components/SessionRecoveryDialog';
import type { TrainingDay, ExerciseGroup } from '../../types';

// 运行期间 checkpoint 间隔（毫秒）
const CHECKPOINT_INTERVAL_MS = 30 * 1000;

export function TodayPage() {
  const activeSession = useSessionStore(state => state.activeSession);
  const endSession = useSessionStore(state => state.endSession);
  const startSession = useSessionStore(state => state.startSession);
  const initSession = useSessionStore(state => state.initialize);
  const addExercise = useSessionStore(state => state.addExercise);
  const ensureSession = useSessionStore(state => state.ensureSession);
  const checkpointSession = useSessionStore(state => state.checkpointSession);
  const hasActiveCardio = useSessionStore(state => state.hasActiveCardio);
  const completeCardio = useSessionStore(state => state.completeCardio);
  const cancelCardio = useSessionStore(state => state.cancelCardio);

  const { currentPlan, initialize: initPlan, advanceToNextDay } = usePlanStore();

  const [trainingMode, setTrainingMode] = useState<'strength' | 'cardio'>('strength');
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [selectedGroupContext, setSelectedGroupContext] = useState<{ phaseId: string, group: ExerciseGroup } | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showCardioEndDialog, setShowCardioEndDialog] = useState(false);

  // 使用 ref 保持最新的 checkpoint 函数引用，避免 effect 频繁重建
  const checkpointRef = useRef(checkpointSession);
  useEffect(() => {
    checkpointRef.current = checkpointSession;
  }, [checkpointSession]);

  useEffect(() => {
    Promise.all([initPlan(), initSession()]).then(() => setInitialized(true));
  }, [initPlan, initSession]);

  // 运行期间每 30 秒 checkpoint（仅触发持久化，setInterval 不作为计时数据源）
  const sessionId = activeSession?.id;
  const sessionTimerStatus = activeSession?.timerStatus;
  useEffect(() => {
    if (!activeSession || activeSession.timerStatus !== 'running') return;
    const interval = setInterval(() => {
      checkpointRef.current();
    }, CHECKPOINT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [sessionId, sessionTimerStatus, activeSession]);

  // 页面隐藏或卸载时立即 checkpoint，防止丢失最近区间
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        checkpointRef.current();
      }
    };
    const handlePageHide = () => {
      checkpointRef.current();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  const todayDay = useMemo<TrainingDay | null>(() => {
    if (!currentPlan || currentPlan.days.length === 0) return null;
    const currentIdx = currentPlan.currentDayIndex ?? 0;
    const day = currentPlan.days[currentIdx];
    return day && day.isActive ? day : null;
  }, [currentPlan]);

  const handleEndTraining = async () => {
    // 检测是否存在 running 或 paused 的有氧记录
    if (hasActiveCardio()) {
      setShowCardioEndDialog(true);
      return;
    }
    await doEndSession();
  };

  const doEndSession = async () => {
    await endSession();
    if (currentPlan) {
      await advanceToNextDay(currentPlan.id);
    }
  };

  const handleCompleteCardioAndEnd = async () => {
    // 完成所有进行中的有氧记录
    const cardioExercises = activeSession?.exercises.filter(
      (e) => e.cardioRecord?.status === 'running' || e.cardioRecord?.status === 'paused',
    ) ?? [];
    for (const ex of cardioExercises) {
      completeCardio(ex.id);
    }
    setShowCardioEndDialog(false);
    await doEndSession();
  };

  const handleDiscardCardioAndEnd = async () => {
    // 放弃所有进行中的有氧记录
    const cardioExercises = activeSession?.exercises.filter(
      (e) => e.cardioRecord?.status === 'running' || e.cardioRecord?.status === 'paused',
    ) ?? [];
    for (const ex of cardioExercises) {
      cancelCardio(ex.id);
    }
    setShowCardioEndDialog(false);
    await doEndSession();
  };

  const handleOpenGroupSelector = (phaseId: string, group: ExerciseGroup) => {
    setSelectedGroupContext({ phaseId, group });
    setShowGroupSelector(true);
  };

  const handleQuickAdd = () => {
    const firstPhase = todayDay?.phases?.[0];
    const firstGroup = firstPhase?.groups?.[0];
    if (!firstPhase || !firstGroup) return;

    ensureSession(currentPlan || undefined, todayDay || undefined);
    handleOpenGroupSelector(firstPhase.id, firstGroup);
  };

  const handleStartTraining = () => {
    if (!todayDay) return;
    startSession(currentPlan || undefined, todayDay);
  };

  if (!initialized) {
    return <LoadingState />;
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <TrainingHeader 
        trainingMode={trainingMode} 
        onModeChange={setTrainingMode} 
        dayName={todayDay?.name}
      />

      <Box
        component="main"
        className="vf-scroll"
        sx={{
          flex: 1,
          overflow: 'auto',
          px: { xs: 2, sm: 3 },
          pb: 'calc(var(--sticky-action-height) + 18px)',
        }}
      >
        {trainingMode === 'strength' ? (
          <>
            <TrainingContextCard todayDay={todayDay} currentPlan={currentPlan} />
            <StrengthSection
              todayDay={todayDay}
              onOpenGroupSelector={handleOpenGroupSelector}
            />
          </>
        ) : (
          <>
            <TrainingContextCard todayDay={todayDay} currentPlan={currentPlan} />
            <CardioSection />
          </>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          zIndex: 900,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.94fr) minmax(0, 1.06fr)',
          gap: 1.25,
          px: { xs: 2, sm: 3 },
          py: 1.5,
          bgcolor: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(18px)',
          borderRadius: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.045)',
        }}
      >
        <Button
          data-testid="quick-add-exercise-button"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleQuickAdd}
          disabled={!todayDay || trainingMode !== 'strength'}
          sx={{
            minHeight: 48,
            borderRadius: '8px',
            borderWidth: '1px !important',
            borderColor: 'divider',
            color: 'primary.main',
            bgcolor: 'background.paper',
            fontSize: '0.95rem',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          }}
        >
          添加动作
        </Button>

        {activeSession ? (
          <Button
            data-testid="end-training-button"
            variant="contained"
            onClick={handleEndTraining}
            startIcon={<WorkoutIcon name="finish" size={21} />}
            sx={{
              minHeight: 48,
              borderRadius: '8px',
              bgcolor: '#05a978',
              backgroundImage: 'none',
              fontWeight: 800,
              fontSize: '0.95rem',
              boxShadow: '0 7px 18px rgba(5, 169, 120, 0.22)',
              '&:hover': { bgcolor: '#048f68', backgroundImage: 'none' },
            }}
          >
            结束训练
          </Button>
        ) : (
          <Button
            data-testid="start-training-button"
            variant="contained"
            onClick={handleStartTraining}
            disabled={!todayDay}
            startIcon={<PlayIcon />}
            sx={{
              minHeight: 48,
              borderRadius: '8px',
              bgcolor: '#05a978',
              backgroundImage: 'none',
              fontWeight: 800,
              fontSize: '0.95rem',
              boxShadow: '0 7px 18px rgba(5, 169, 120, 0.22)',
              '&:hover': { bgcolor: '#048f68', backgroundImage: 'none' },
            }}
          >
            开始训练
          </Button>
        )}
      </Paper>

      {selectedGroupContext && (
        <ExerciseSelector
          open={showGroupSelector}
          group={selectedGroupContext.group}
          onClose={() => {
            setShowGroupSelector(false);
            setSelectedGroupContext(null);
          }}
          onSelect={(exercise) => {
            // 确保会话已启动
            ensureSession(currentPlan || undefined, todayDay || undefined);

            // 添加动作
            addExercise(
              exercise,
              selectedGroupContext.phaseId,
              selectedGroupContext.group.id
            );

            setShowGroupSelector(false);
            setSelectedGroupContext(null);
          }}
        />
      )}

      <SessionRecoveryDialog />

      <Dialog
        open={showCardioEndDialog}
        onClose={(_, reason) => {
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
          setShowCardioEndDialog(false);
        }}
        maxWidth="sm"
        fullWidth
        data-testid="cardio-end-confirm-dialog"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningRounded color="warning" />
          存在未完成的有氧训练
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            当前有进行中的有氧训练记录。结束整场训练前，请选择如何处理。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2, pt: 0 }}>
          <Button
            data-testid="cardio-end-complete"
            onClick={handleCompleteCardioAndEnd}
            variant="contained"
            color="primary"
            fullWidth
          >
            完成当前有氧并结束训练
          </Button>
          <Button
            data-testid="cardio-end-back"
            onClick={() => setShowCardioEndDialog(false)}
            variant="outlined"
            fullWidth
          >
            返回继续记录
          </Button>
          <Button
            data-testid="cardio-end-discard"
            onClick={handleDiscardCardioAndEnd}
            color="error"
            fullWidth
          >
            放弃当前有氧并结束训练
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function LoadingState() {
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Box sx={{
          width: 48, height: 48, borderRadius: '12px',
          background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2,
          animation: 'pulse 2s infinite',
        }}
      >
        <FitnessCenterIcon sx={{ color: 'white', fontSize: 24 }} />
      </Box>
      <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>加载中...</Typography>
    </Box>
  );
}
