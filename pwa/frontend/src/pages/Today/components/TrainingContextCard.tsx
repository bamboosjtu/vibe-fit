import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, Typography } from '@mui/material';
import {
  CalendarMonthOutlined as CalendarIcon,
  LocalFireDepartmentRounded as FireIcon,
  SwapHorizRounded as SwitchIcon,
  TimerOutlined as TimerIcon,
} from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { buildTrainingContext, type SessionRuntimeStatus } from '../../../domain/trainingContext';
import type { TrainingDay, TrainingPlan } from '../../../types';

interface TrainingContextCardProps {
  todayDay: TrainingDay | null;
  currentPlan: TrainingPlan | null;
}

/** 状态标签文案与样式 */
function getStatusBadge(status: SessionRuntimeStatus): { label: string; bgcolor: string; color: string } {
  switch (status) {
    case 'running':
      return { label: '进行中', bgcolor: '#07a978', color: '#fff' };
    case 'paused':
      return { label: '已暂停', bgcolor: 'rgba(245, 158, 11, 0.12)', color: '#b45309' };
    case 'completed':
      return { label: '已完成', bgcolor: 'rgba(5,169,120,0.09)', color: '#078763' };
    case 'idle':
    default:
      return { label: '准备中', bgcolor: 'rgba(5,169,120,0.09)', color: '#078763' };
  }
}

export function TrainingContextCard({ todayDay, currentPlan }: TrainingContextCardProps) {
  const navigate = useNavigate();
  const activeSession = useSessionStore(state => state.activeSession);

  // 统一通过 ViewModel 构建训练上下文，不再临时拼接
  const ctx = buildTrainingContext(currentPlan, todayDay, activeSession);

  if (ctx.isFreeTraining && !activeSession) {
    // 无计划且无活动会话：不渲染（由 TodayPage 显示空状态）
    return null;
  }

  const statusBadge = getStatusBadge(ctx.runtimeStatus);
  const segments = ctx.phases.length > 0
    ? ctx.phases
    : // 自由训练或无阶段数据：显示单一进度条
      [{ id: 'single', status: ctx.runtimeStatus === 'running' ? 'current' as const : 'upcoming' as const }];

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
          {ctx.dayName}
          {!ctx.isFreeTraining && ctx.dayIndex && (
            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.85em', fontWeight: 700, ml: 0.6 }}>
              · Day {ctx.dayIndex}
            </Typography>
          )}
        </Typography>
        <Chip
          size="small"
          label={statusBadge.label}
          sx={{
            height: 23,
            borderRadius: '999px',
            bgcolor: statusBadge.bgcolor,
            color: statusBadge.color,
            fontSize: '0.7rem',
            fontWeight: 800,
          }}
        />
      </Box>

      {/* 元信息行 + 切换计划入口 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.15 }}>
        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.85, color: 'text.secondary', flexWrap: 'wrap' }}>
          {!ctx.isFreeTraining && ctx.dayIndex && ctx.totalDays && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
              <CalendarIcon sx={{ fontSize: 18 }} />
              <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                训练日 {ctx.dayIndex}/{ctx.totalDays}
              </Typography>
            </Box>
          )}
          {ctx.estimatedMinutes && (
            <>
              {!ctx.isFreeTraining && <Box sx={{ width: '1px', height: 14, bgcolor: 'divider' }} />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }} title="基于训练组数的估算值，仅供参考">
                <TimerIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  约 {ctx.estimatedMinutes} 分钟
                </Typography>
              </Box>
            </>
          )}
          {ctx.currentPhaseIndex && ctx.totalPhases > 0 && (
            <>
              <Box sx={{ width: '1px', height: 14, bgcolor: 'divider' }} />
              <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                阶段 {ctx.currentPhaseIndex}/{ctx.totalPhases}
              </Typography>
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

      {/* 分段进度条：由阶段状态驱动 */}
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
