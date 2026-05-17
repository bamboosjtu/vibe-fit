import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { FitnessCenter as FitnessCenterIcon } from '@mui/icons-material';
import { useSessionStore, usePlanStore } from '../../stores';
import { ExerciseSelector } from '../../components/ExerciseSelector';
import { TrainingHeader } from './components/TrainingHeader';
import { StrengthSection } from './components/StrengthSection';
import { CardioSection } from './components/CardioSection';
import { RestTimerOverlay } from './components/RestTimerOverlay';
import type { TrainingDay, ExerciseGroup } from '../../types';

export function TodayPage() {
  const activeSession = useSessionStore(state => state.activeSession);
  const endSession = useSessionStore(state => state.endSession);
  const initSession = useSessionStore(state => state.initialize);
  const addExercise = useSessionStore(state => state.addExercise);
  const ensureSession = useSessionStore(state => state.ensureSession);

  const { currentPlan, initialize: initPlan, advanceToNextDay } = usePlanStore();
  
  const [trainingMode, setTrainingMode] = useState<'strength' | 'cardio'>('strength');
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [selectedGroupContext, setSelectedGroupContext] = useState<{ phaseId: string, group: ExerciseGroup } | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([initPlan(), initSession()]).then(() => setInitialized(true));
  }, [initPlan, initSession]);

  const todayDay = useMemo<TrainingDay | null>(() => {
    if (!currentPlan || currentPlan.days.length === 0) return null;
    const currentIdx = currentPlan.currentDayIndex ?? 0;
    const day = currentPlan.days[currentIdx];
    return day && day.isActive ? day : null;
  }, [currentPlan]);

  const handleEndTraining = async () => {
    await endSession();
    if (currentPlan) {
      await advanceToNextDay(currentPlan.id);
    }
  };

  const handleOpenGroupSelector = (phaseId: string, group: ExerciseGroup) => {
    setSelectedGroupContext({ phaseId, group });
    setShowGroupSelector(true);
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

      <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
        {trainingMode === 'strength' ? (
          <StrengthSection 
            todayDay={todayDay} 
            onOpenGroupSelector={handleOpenGroupSelector} 
          />
        ) : (
          <CardioSection />
        )}
        
        {activeSession && (
          <Button
            data-testid="end-training-button"
            variant="contained"
            fullWidth
            onClick={handleEndTraining}
            sx={{ 
              mt: 4, mb: 2, py: 2, borderRadius: '16px',
              background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)',
              fontWeight: 700, fontSize: '1.1rem'
            }}
          >
            结束训练并记录
          </Button>
        )}
      </Box>

      <RestTimerOverlay />

      {selectedGroupContext && (
        <ExerciseSelector 
          open={showGroupSelector}
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
