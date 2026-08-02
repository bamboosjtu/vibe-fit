import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Typography } from '@mui/material';
import {
  CalendarMonthOutlined as CalendarIcon,
  LocalFireDepartmentRounded as FireIcon,
  SwapHorizRounded as SwitchIcon,
  TimerOutlined as TimerIcon,
} from '@mui/icons-material';
import type { TrainingDay, TrainingPlan } from '../../../types';
import { useSessionStore } from '../../../stores';

interface TrainingContextCardProps {
  todayDay: TrainingDay | null;
  currentPlan: TrainingPlan | null;
}

export function TrainingContextCard({ todayDay, currentPlan }: TrainingContextCardProps) {
  const navigate = useNavigate();
  const activeSession = useSessionStore(state => state.activeSession);

  // 计算阶段完成状态
  const phaseProgress = useMemo(() => {
    if (!todayDay?.phases || !activeSession) return [];
    return todayDay.phases.map((phase) => {
      const phaseExercises = activeSession.exercises.filter(
        (ex) => ex.phaseId === phase.id || ex.groupId === 'legacy' || !ex.groupId,
      );
      if (phaseExercises.length === 0) {
        return { id: phase.id, status: 'upcoming' as const };
      }
      const allComplete = phaseExercises.every(
        (ex) => ex.sets.length > 0 && ex.sets.every((s) => Boolean(s.completedAt)),
      );
      if (allComplete) {
        return { id: phase.id, status: 'completed' as const };
      }
      const anyComplete = phaseExercises.some(
        (ex) => ex.sets.some((s) => Boolean(s.completedAt)),
      );
      return { id: phase.id, status: anyComplete ? 'current' as const : 'upcoming' as const };
    });
  }, [todayDay, activeSession]);

  if (!todayDay) return null;

  const currentDayIndex = currentPlan?.currentDayIndex ?? 0;
  const totalDays = currentPlan?.days.length ?? 1;

  // 预计时长（从目标组数估算）
  const targetSets = todayDay.phases?.reduce(
    (phaseTotal, phase) =>
      phaseTotal + phase.groups.reduce((groupTotal, group) => groupTotal + (group.targetTotalSets ?? 3), 0),
    0,
  ) ?? 0;
  const estimatedMinutes = targetSets > 0 ? Math.max(30, Math.round((targetSets * 2.15) / 5) * 5) : null;

  // 分段进度条：优先使用阶段数量，无阶段时使用天数
  const segments = phaseProgress.length > 0
    ? phaseProgress
    : Array.from({ length: Math.max(6, totalDays) }, (_, i) => ({
        id: `day-${i}`,
        status: i < currentDayIndex ? 'completed' as const : i === currentDayIndex ? 'current' as const : 'upcoming' as const,
      }));

  return (
    <Box sx={{ pt: 1.5, pb: 2.1 }}>
      {/* 主标题行：训练日名称 + Day 序号 + 状态标签 */}
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

      {/* 元信息行 + 切换计划入口 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.15 }}>
        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.85, color: 'text.secondary' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
            <CalendarIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
              第 {currentDayIndex + 1} 练 / 共 {totalDays} 练
            </Typography>
          </Box>
          {estimatedMinutes && (
            <>
              <Box sx={{ width: '1px', height: 14, bgcolor: 'divider' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
                <TimerIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  预计 {estimatedMinutes} 分钟
                </Typography>
              </Box>
            </>
          )}
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

      {/* 分段进度条：优先对应训练阶段数量 */}
      <Box aria-label="训练阶段进度" sx={{ display: 'grid', gridTemplateColumns: `repeat(${segments.length}, 1fr)`, gap: 0.6, mt: 1.45 }}>
        {segments.map((seg) => (
          <Box
            key={seg.id}
            sx={{
              height: 4,
              borderRadius: '999px',
              bgcolor: seg.status === 'completed' || seg.status === 'current'
                ? '#05a978'
                : '#e2e5eb',
              opacity: seg.status === 'current' ? 0.7 : 1,
              transition: 'background-color 220ms ease',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
