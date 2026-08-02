import { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  AddRounded as AddIcon,
  CheckRounded as CheckIcon,
  ExpandMoreRounded as ExpandIcon,
} from '@mui/icons-material';
import type { ExerciseGroup, TrainingDay, TrainingPhase } from '../../../types';
import { useSessionStore } from '../../../stores';
import { ExerciseCard } from './ExerciseCard';

interface StrengthSectionProps {
  todayDay: TrainingDay | null;
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void;
}

export function StrengthSection({ todayDay, onOpenGroupSelector }: StrengthSectionProps) {
  if (!todayDay || !todayDay.phases || todayDay.phases.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 7 }}>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>今日没有力量训练安排</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 1 }}>
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
