import { Box, Typography, IconButton, Paper } from '@mui/material';
import { Close as CloseIcon, Timer as TimerIcon } from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { useEffect } from 'react';

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
        bottom: 90,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        bgcolor: 'primary.main',
        color: 'white',
        borderRadius: '24px',
        px: 3,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
        animation: 'slideInUp 0.3s ease-out',
      }}
    >
      <TimerIcon />
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, opacity: 0.9 }}>
          休息中
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
          {restTimer}s
        </Typography>
      </Box>
      <IconButton size="small" onClick={stopRestTimer} sx={{ color: 'white' }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
}
