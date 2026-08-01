import { Box, Typography, IconButton, Paper } from '@mui/material';
import { useSessionStore } from '../../../stores';
import { useEffect } from 'react';
import { WorkoutIcon } from '../../../components/WorkoutArtwork';

export function RestTimerOverlay() {
  const { restTimer, isRestTimerActive, decrementRestTimer, stopRestTimer } = useSessionStore();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRestTimerActive && restTimer > 0) {
      interval = setInterval(() => {
        decrementRestTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRestTimerActive, restTimer, decrementRestTimer]);

  if (!isRestTimerActive) return null;

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 96px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        bgcolor: 'rgba(255,255,255,0.96)',
        color: 'text.primary',
        borderRadius: '12px',
        px: 2,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 14px 32px rgba(15, 23, 42, 0.14)',
        animation: 'slideInUp 0.3s ease-out',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ color: 'primary.main' }}>
        <WorkoutIcon name="timer" size={24} />
      </Box>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, opacity: 0.9 }}>
          休息中
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {restTimer}s
        </Typography>
      </Box>
      <IconButton data-testid="rest-timer-close-button" size="small" onClick={stopRestTimer} sx={{ color: 'text.secondary' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1 }}>×</Typography>
      </IconButton>
    </Paper>
  );
}
