import { useEffect, useState } from 'react';
import { Box, Paper, Tab, Tabs, Typography, IconButton, Tooltip } from '@mui/material';
import { PauseRounded, PlayArrowRounded } from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { WorkoutIcon } from '../../../components/WorkoutArtwork';
import {
  computeElapsedSeconds,
  formatTimer,
  getTimerStatusText,
} from '../../../domain/sessionTimer';

interface TrainingHeaderProps {
  trainingMode: 'strength' | 'cardio';
  onModeChange: (mode: 'strength' | 'cardio') => void;
  dayName?: string;
}

export function TrainingHeader({ trainingMode, onModeChange }: TrainingHeaderProps) {
  const activeSession = useSessionStore(state => state.activeSession);
  const pauseSession = useSessionStore(state => state.pauseSession);
  const continueSession = useSessionStore(state => state.continueSession);

  // setInterval 仅触发 UI 重绘，不作为计时数据源。
  // 计时数据由 computeElapsedSeconds 按当前时间戳实时计算。
  const [, setTick] = useState(0);
  const sessionId = activeSession?.id;
  const sessionTimerStatus = activeSession?.timerStatus;
  useEffect(() => {
    if (!activeSession || activeSession.timerStatus !== 'running') return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionId, sessionTimerStatus, activeSession]);

  const timerStatus = activeSession?.timerStatus;
  const isRunning = timerStatus === 'running';
  const isPaused = timerStatus === 'paused';

  const elapsedSeconds = activeSession
    ? computeElapsedSeconds(activeSession)
    : 0;

  const statusText = activeSession
    ? getTimerStatusText(timerStatus)
    : '准备开始';

  const handleToggleTimer = () => {
    if (isRunning) {
      pauseSession();
    } else if (isPaused) {
      continueSession();
    }
  };

  const toggleLabel = isRunning ? '暂停训练' : '继续训练';

  return (
    <Box
      component="header"
      sx={{
        px: { xs: 2, sm: 3 },
        pt: 'calc(var(--safe-top) + 16px)',
        pb: 1.75,
        bgcolor: 'background.default',
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(82px, 1fr) auto minmax(104px, 1fr)',
          alignItems: 'center',
          gap: 1,
          minHeight: 56,
          mb: 1.75,
        }}
      >
        <Typography
          component="div"
          sx={{
            color: '#079b70',
            fontSize: { xs: '1.62rem', sm: '1.8rem' },
            fontWeight: 900,
            fontStyle: 'italic',
            lineHeight: 1,
            letterSpacing: '-0.055em',
          }}
        >
          VibeFit
        </Typography>

        <Typography
          component="h1"
          sx={{
            color: 'text.primary',
            fontSize: { xs: '1.26rem', sm: '1.42rem' },
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          今日训练
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.85 }}>
          <Box sx={{ color: activeSession ? '#37934b' : 'text.disabled', flexShrink: 0 }}>
            <WorkoutIcon name="timer" size={31} strokeWidth={2.4} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                sx={{
                  color: activeSession ? '#078c66' : 'text.secondary',
                  fontSize: { xs: '0.98rem', sm: '1.08rem' },
                  fontWeight: 900,
                  lineHeight: 1.05,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatTimer(elapsedSeconds)}
              </Typography>
              {activeSession && (isRunning || isPaused) && (
                <Tooltip title={toggleLabel}>
                  <IconButton
                    data-testid="timer-toggle-button"
                    aria-label={toggleLabel}
                    onClick={handleToggleTimer}
                    size="small"
                    sx={{
                      p: 0.25,
                      color: isRunning ? '#078c66' : '#d97706',
                      '&:hover': { bgcolor: 'rgba(5, 169, 120, 0.08)' },
                    }}
                  >
                    {isRunning ? (
                      <PauseRounded sx={{ fontSize: 20 }} />
                    ) : (
                      <PlayArrowRounded sx={{ fontSize: 20 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            <Box sx={{ mt: 0.45, display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: isRunning
                    ? '#05b784'
                    : isPaused
                      ? '#d97706'
                      : 'text.disabled',
                  ...(isRunning
                    ? {
                        animation: 'pulse 1.6s ease-in-out infinite',
                      }
                    : {}),
                }}
              />
              <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem', lineHeight: 1 }}>
                {statusText}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          borderRadius: '7px',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 5px 13px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Tabs
          value={trainingMode}
          onChange={(_, value) => onModeChange(value)}
          variant="fullWidth"
          sx={{
            minHeight: 50,
            '& .MuiTabs-flexContainer': { gap: 0 },
            '& .MuiTabs-indicator': { display: 'none' },
          }}
        >
          <Tab
            data-testid="training-mode-strength"
            value="strength"
            disableRipple
            icon={<WorkoutIcon name="strength" size={21} />}
            iconPosition="start"
            label="力量"
            sx={tabStyle(trainingMode === 'strength')}
          />
          <Tab
            data-testid="training-mode-cardio"
            value="cardio"
            disableRipple
            icon={<WorkoutIcon name="cardio" size={21} />}
            iconPosition="start"
            label="有氧"
            sx={tabStyle(trainingMode === 'cardio')}
          />
        </Tabs>
      </Paper>
    </Box>
  );
}

const tabStyle = (isActive: boolean) => ({
  minHeight: 50,
  m: 0,
  borderRadius: '6px',
  backgroundColor: isActive ? '#06a878 !important' : 'transparent',
  color: isActive ? '#fff !important' : 'text.secondary',
  fontSize: '0.95rem',
  fontWeight: 800,
  letterSpacing: '0.02em',
  boxShadow: isActive ? '0 3px 10px rgba(5, 169, 120, 0.24)' : 'none',
  transition: 'background-color 180ms ease, color 180ms ease, box-shadow 180ms ease',
  '& .MuiTab-iconWrapper': { mr: 1 },
  '&:hover': { backgroundColor: isActive ? '#06986e !important' : 'rgba(5, 169, 120, 0.045)' },
});
