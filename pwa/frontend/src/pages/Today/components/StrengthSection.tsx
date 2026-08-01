import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Typography } from '@mui/material';
import {
  AddRounded as AddIcon,
  CalendarMonthOutlined as CalendarIcon,
  CheckRounded as CheckIcon,
  ExpandMoreRounded as ExpandIcon,
  LocalFireDepartmentRounded as FireIcon,
  SwapHorizRounded as SwitchIcon,
  TimerOutlined as TimerIcon,
} from '@mui/icons-material';
import type { ExerciseGroup, TrainingDay, TrainingPhase, TrainingPlan } from '../../../types';
import { useSessionStore } from '../../../stores';
import { ExerciseCard } from './ExerciseCard';

interface StrengthSectionProps {
  todayDay: TrainingDay | null;
  currentPlan: TrainingPlan | null;
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void;
}

export function StrengthSection({ todayDay, currentPlan, onOpenGroupSelector }: StrengthSectionProps) {
  if (!todayDay || !todayDay.phases || todayDay.phases.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 7 }}>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>今日没有力量训练安排</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 1 }}>
      <WorkoutOverview todayDay={todayDay} currentPlan={currentPlan} />

      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {todayDay.phases.map((phase, phaseIndex) => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            phaseIndex={phaseIndex}
            initiallyExpanded={phaseIndex === 0}
            onOpenGroupSelector={onOpenGroupSelector}
          />
        ))}
      </Box>
    </Box>
  );
}

function WorkoutOverview({ todayDay, currentPlan }: { todayDay: TrainingDay; currentPlan: TrainingPlan | null }) {
  const navigate = useNavigate();
  const activeSession = useSessionStore(state => state.activeSession);
  const currentDayIndex = currentPlan?.currentDayIndex ?? 0;
  const totalDays = currentPlan?.days.length ?? 1;
  const segmentCount = Math.max(6, totalDays);
  const targetSets = todayDay.phases.reduce(
    (phaseTotal, phase) => phaseTotal + phase.groups.reduce((groupTotal, group) => groupTotal + (group.targetTotalSets ?? 3), 0),
    0,
  );
  const estimatedMinutes = Math.max(30, Math.round((targetSets * 2.15) / 5) * 5);

  return (
    <Box sx={{ pt: 1.5, pb: 2.1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.8 }}>
        <FireIcon sx={{ color: '#ff8a00', fontSize: 25 }} />
        <Typography
          component="h2"
          sx={{
            color: 'text.primary',
            fontSize: { xs: '1.2rem', sm: '1.5rem' },
            fontWeight: 900,
            letterSpacing: '-0.025em',
          }}
        >
          {todayDay.name} · Day {currentDayIndex + 1}
        </Typography>
        <Chip
          size="small"
          label={activeSession ? '进行中' : '待开始'}
          sx={{
            height: 23,
            borderRadius: '999px',
            bgcolor: activeSession ? '#07a978' : 'rgba(5,169,120,0.09)',
            color: activeSession ? '#fff' : '#078763',
            fontSize: '0.7rem',
            fontWeight: 800,
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.15 }}>
        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.85, color: 'text.secondary' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
              <CalendarIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                第 {currentDayIndex + 1} 练 / 共 {totalDays} 练
              </Typography>
            </Box>
            <Box sx={{ width: '1px', height: 14, bgcolor: 'divider' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
              <TimerIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>预计 {estimatedMinutes} 分钟</Typography>
            </Box>
        </Box>

        <Button
          variant="outlined"
          startIcon={<SwitchIcon />}
          onClick={() => navigate('/plans')}
          sx={{
            minWidth: 88,
            minHeight: 40,
            flexShrink: 0,
            borderWidth: '1px !important',
            borderColor: 'divider',
            borderRadius: '7px',
            bgcolor: 'background.paper',
            color: 'text.primary',
            px: 1.15,
            fontSize: '0.72rem',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.07)',
            '@media (max-width: 374px)': { minWidth: 40, px: 0.9, '& .MuiButton-startIcon': { m: 0 }, fontSize: 0 },
          }}
        >
          切换计划
        </Button>
      </Box>

      <Box aria-label="训练计划进度" sx={{ display: 'grid', gridTemplateColumns: `repeat(${segmentCount}, 1fr)`, gap: 0.6, mt: 1.45 }}>
        {Array.from({ length: segmentCount }, (_, index) => (
          <Box
            key={index}
            sx={{
              height: 4,
              borderRadius: '999px',
              bgcolor: index <= currentDayIndex ? '#05a978' : '#e2e5eb',
              transition: 'background-color 220ms ease',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function PhaseSection({
  phase,
  phaseIndex,
  initiallyExpanded,
  onOpenGroupSelector,
}: {
  phase: TrainingPhase;
  phaseIndex: number;
  initiallyExpanded: boolean;
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const activeSession = useSessionStore(state => state.activeSession);

  const exercisesByGroup = useMemo(() => phase.groups.map(group => ({
    group,
    exercises: activeSession?.exercises.filter(exercise => {
      if (exercise.groupId === group.id) return true;
      if (exercise.groupId === 'legacy' || !exercise.groupId) {
        return group.availableExercises.some(candidate => candidate.exerciseId === exercise.exerciseId);
      }
      return false;
    }) ?? [],
  })), [activeSession, phase.groups]);

  const phaseExercises = exercisesByGroup.flatMap(item => item.exercises);
  const isComplete = phaseExercises.length > 0 && phaseExercises.every(exercise =>
    exercise.sets.length > 0 && exercise.sets.every(set => Boolean(set.completedAt)),
  );
  const displayCount = phaseExercises.length || phase.groups.length;

  return (
    <Box
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        bgcolor: 'background.paper',
        boxShadow: isExpanded ? '0 7px 20px rgba(15, 23, 42, 0.045)' : 'none',
      }}
    >
      <Box
        component="button"
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(value => !value)}
        sx={{
          width: '100%',
          minHeight: 58,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.5,
          py: 1.1,
          border: 0,
          bgcolor: 'transparent',
          color: 'text.primary',
          textAlign: 'left',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(5, 169, 120, 0.025)' },
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            bgcolor: '#05a978',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 900,
            boxShadow: '0 3px 8px rgba(5, 169, 120, 0.18)',
          }}
        >
          {isComplete ? <CheckIcon sx={{ fontSize: 21 }} /> : phaseIndex + 1}
        </Box>
        <Typography sx={{ flex: 1, fontSize: '1rem', fontWeight: 900 }}>{phase.name}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          {displayCount} 个动作
        </Typography>
        <ExpandIcon
          sx={{
            color: 'text.secondary',
            fontSize: 23,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 180ms ease',
          }}
        />
      </Box>

      {isExpanded && (
        <Box sx={{ px: 0.75, pb: 0.75, animation: 'todaySectionReveal 200ms ease-out' }}>
          {phaseExercises.length === 0 ? (
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 1, py: 1.25 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1 }}>
                选择本阶段动作后，可直接记录重量、次数与完成状态。
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                {phase.groups.map(group => (
                  <Button
                    key={group.id}
                    data-testid={`add-exercise-${group.id}`}
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => onOpenGroupSelector(phase.id, group)}
                    sx={{
                      borderWidth: '1px !important',
                      borderColor: 'rgba(5,169,120,0.36)',
                      borderRadius: '7px',
                      color: '#078c66',
                      bgcolor: 'rgba(5,169,120,0.035)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                    }}
                  >
                    添加{group.name}
                  </Button>
                ))}
              </Box>
            </Box>
          ) : (
            exercisesByGroup.map(({ group, exercises }) => (
              <Box key={group.id}>
                {exercises.map(exercise => <ExerciseCard key={exercise.id} sessionExercise={exercise} />)}
                <Button
                  data-testid={`add-exercise-${group.id}`}
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => onOpenGroupSelector(phase.id, group)}
                  sx={{ ml: 0.75, mb: 0.75, color: '#078c66', fontSize: '0.72rem', fontWeight: 800 }}
                >
                  添加{group.name}动作
                </Button>
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
