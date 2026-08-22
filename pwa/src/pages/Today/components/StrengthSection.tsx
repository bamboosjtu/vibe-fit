import { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  AddRounded as AddIcon,
  CheckRounded as CheckIcon,
  ExpandMoreRounded as ExpandIcon,
} from '@mui/icons-material';
import type { ExerciseGroup, TrainingDay } from '../../../types';
import { useSessionStore, usePlanStore } from '../../../stores';
import { buildTrainingContext, type PhaseViewModel } from '../../../domain/trainingContext';
import { vfTokens } from '../../../app/theme';
import { ExerciseCard } from './ExerciseCard';

interface StrengthSectionProps {
  todayDay: TrainingDay | null;
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void;
}

export function StrengthSection({ todayDay, onOpenGroupSelector }: StrengthSectionProps) {
  const activeSession = useSessionStore(state => state.activeSession);
  const { currentPlan } = usePlanStore();

  // 统一从 domain 层获取阶段 ViewModel，UI 不再自行计算 isComplete
  const ctx = useMemo(
    () => buildTrainingContext(currentPlan, todayDay, activeSession),
    [currentPlan, todayDay, activeSession],
  );
  const phaseViewModels = ctx.phaseViewModels;

  if (!todayDay || !todayDay.phases || todayDay.phases.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 7 }}>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>今日没有力量训练安排</Typography>
      </Box>
    );
  }

  if (phaseViewModels.length === 0) {
    return null;
  }

  return (
    <Box sx={{ pb: 1 }}>
      <Box sx={{ display: 'grid', gap: 1.25 }}>
        {phaseViewModels.map((phaseVM, phaseIndex) => (
          <PhaseSection
            key={phaseVM.id}
            phaseVM={phaseVM}
            phaseIndex={phaseIndex}
            todayDay={todayDay}
            onOpenGroupSelector={onOpenGroupSelector}
          />
        ))}
      </Box>
    </Box>
  );
}

function PhaseSection({
  phaseVM,
  phaseIndex,
  todayDay,
  onOpenGroupSelector,
}: {
  phaseVM: PhaseViewModel;
  phaseIndex: number;
  todayDay: TrainingDay;
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void;
}) {
  // 默认展开当前阶段；阶段完成后自动展开下一个未完成阶段（由 phaseVM.status 驱动）
  const [isExpanded, setIsExpanded] = useState(phaseVM.status === 'current');
  // 跟踪上次 status，用于在 status 切换为 current 时自动展开（render 阶段调整 state，避免 effect 级联渲染）
  const [prevStatus, setPrevStatus] = useState(phaseVM.status);
  if (phaseVM.status !== prevStatus) {
    setPrevStatus(phaseVM.status);
    if (phaseVM.status === 'current' && !isExpanded) {
      setIsExpanded(true);
    }
  }
  const activeSession = useSessionStore(state => state.activeSession);

  // 通过 phaseId + groups 查找原始 phase 数据（用于渲染 group 列表）
  const phase = todayDay.phases.find(p => p.id === phaseVM.id);

  const exercisesByGroup = useMemo(() => {
    if (!phase) return [];
    return phase.groups.map(group => ({
      group,
      exercises: activeSession?.exercises.filter(exercise => exercise.groupId === group.id) ?? [],
    }));
  }, [activeSession, phase]);

  const phaseExercises = exercisesByGroup.flatMap(item => item.exercises);
  // 完成状态直接来自 domain 层 ViewModel
  const isComplete = phaseVM.status === 'completed';

  return (
    <Box
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: phaseVM.status === 'current' ? vfTokens.borderActive : 'divider',
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
            bgcolor: isComplete ? vfTokens.primary : phaseVM.status === 'current' ? vfTokens.primary : vfTokens.surfaceDisabled,
          color: isComplete || phaseVM.status === 'current' ? '#fff' : 'text.secondary',
            fontSize: '0.95rem',
            fontWeight: 900,
            boxShadow: phaseVM.status === 'current' ? '0 3px 8px rgba(5, 169, 120, 0.18)' : 'none',
            border: isComplete ? 'none' : phaseVM.status === 'current' ? 'none' : `1.5px solid ${vfTokens.borderSubtle}`,
          }}
        >
          {isComplete ? <CheckIcon sx={{ fontSize: 21 }} /> : phaseIndex + 1}
        </Box>
        <Typography sx={{ flex: 1, fontSize: '1rem', fontWeight: 900 }}>{phaseVM.name}</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          动作组 {phaseVM.selectedGroupCount}/{phaseVM.requiredGroupCount} · 完成 {phaseVM.completedSets}/{phaseVM.targetSets || phaseExercises.length} 组
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

      {isExpanded && phase && (
        <Box sx={{ px: 0.75, pb: 0.75, animation: 'todaySectionReveal 200ms ease-out' }}>
          {phaseExercises.length === 0 ? (
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', px: 1, py: 1.25 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1 }}>
                选择本阶段动作后，可直接记录重量、次数与完成状态。
              </Typography>
              <Box sx={{ display: 'grid', gap: 0.5 }}>
                  {phase.groups.map(group => (
                    <Box key={group.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 36 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography component="span" sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{group.name}</Typography>
                        {group.description && (
                          <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem', ml: 0.75 }}>{group.description}</Typography>
                        )}
                      </Box>
                      <Button
                        data-testid={`add-exercise-${group.id}`}
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => onOpenGroupSelector(phase.id, group)}
                        sx={{
                          borderWidth: '1px !important',
                          borderColor: vfTokens.borderActive,
                          borderRadius: '7px',
                          color: vfTokens.primaryDark,
                          bgcolor: vfTokens.primarySurface,
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        添加
                      </Button>
                    </Box>
                  ))}
                </Box>
            </Box>
          ) : (
            exercisesByGroup.map(({ group, exercises }) => {
                const groupCompletedSets = exercises.reduce(
                  (total, ex) => total + ex.sets.filter((s) => Boolean(s.completedAt)).length,
                  0,
                );
                const groupTarget = group.targetTotalSets ?? 0;
                return (
                  <Box key={group.id} sx={{ mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, px: 0.75, py: 0.5 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 800 }}>{group.name}</Typography>
                      {group.description && (
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{group.description}</Typography>
                      )}
                      {groupTarget > 0 && (
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', ml: 'auto' }}>
                          完成 {groupCompletedSets}/{groupTarget} 组
                        </Typography>
                      )}
                    </Box>
                    {exercises.map(exercise => <ExerciseCard key={exercise.id} sessionExercise={exercise} />)}
                    <Button
                      data-testid={`add-exercise-${group.id}`}
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => onOpenGroupSelector(phase.id, group)}
                      sx={{ ml: 0.75, mb: 0.75, color: vfTokens.primaryDark, fontSize: '0.72rem', fontWeight: 800 }}
                    >
                      添加{group.name}动作
                    </Button>
                  </Box>
                );
              })
          )}
        </Box>
      )}
    </Box>
  );
}
