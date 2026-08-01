import { Box, Typography, Paper, Tabs, Tab } from '@mui/material';
import { useSessionStore } from '../../../stores';
import { useEffect } from 'react';
import { WorkoutIcon } from '../../../components/WorkoutArtwork';

interface TrainingHeaderProps {
  trainingMode: 'strength' | 'cardio';
  onModeChange: (mode: 'strength' | 'cardio') => void;
  dayName?: string;
}

export function TrainingHeader({ trainingMode, onModeChange, dayName }: TrainingHeaderProps) {
  const { trainingTimer, incrementTimer } = useSessionStore();

  useEffect(() => {
    const interval = setInterval(() => {
      incrementTimer();
    }, 1000);
    return () => clearInterval(interval);
  }, [incrementTimer]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Box sx={{ px: 2, pt: 'calc(var(--safe-top) + 14px)', pb: 1.5, bgcolor: 'background.default', flexShrink: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            fontWeight="bold"
            sx={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.2,
              letterSpacing: 0,
            }}
          >
            VibeFit
          </Typography>

          {dayName && (
            <Typography
              variant="caption"
              sx={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                color: 'text.secondary',
                mt: 0.5,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {dayName}
            </Typography>
          )}
        </Box>

        <Typography
          variant="h6"
          sx={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            letterSpacing: 0,
            color: 'text.primary',
            whiteSpace: 'nowrap',
          }}
        >
          今日训练
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
            minWidth: 0,
          }}
        >
          <Box sx={{ color: 'primary.main' }}>
            <WorkoutIcon name="timer" size={28} strokeWidth={2.4} />
          </Box>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{
              fontFamily: 'var(--font-display)',
              color: 'primary.main',
              minWidth: '64px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTime(trainingTimer)}
          </Typography>
        </Box>
      </Box>

      <Paper 
        sx={{ 
          borderRadius: '10px',
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Tabs
          value={trainingMode}
          onChange={(_, v) => onModeChange(v)}
          variant="fullWidth"
          sx={{
            minHeight: 44,
            '& .MuiTabs-flexContainer': {
              bgcolor: 'background.paper',
              gap: '4px',
              p: '4px',
            },
            '& .MuiTabs-indicator': {
              display: 'none',
            },
          }}
        >
          <Tab
            data-testid="training-mode-strength"
            value="strength"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WorkoutIcon name="strength" size={20} />
                <span>力量</span>
              </Box>
            }
            sx={tabStyle(trainingMode === 'strength', '#10B981', '#06B6D4')}
          />
          <Tab
            data-testid="training-mode-cardio"
            value="cardio"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WorkoutIcon name="cardio" size={20} />
                <span>有氧</span>
              </Box>
            }
            sx={tabStyle(trainingMode === 'cardio', '#059669', '#0891B2')}
          />
        </Tabs>
      </Paper>
    </Box>
  );
}

const tabStyle = (isActive: boolean, color1: string, color2: string) => ({
  py: 1.5,
  minHeight: 44,
  borderRadius: '8px',
  bgcolor: isActive 
    ? `linear-gradient(135deg, ${color1} 0%, ${color2} 100%) !important` 
    : 'transparent',
  fontWeight: isActive ? 700 : 600,
  color: isActive ? '#ffffff' : 'text.secondary',
  boxShadow: isActive 
    ? `0 2px 8px ${color1}4D` 
    : 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    bgcolor: isActive 
      ? `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)` 
      : 'rgba(16, 185, 129, 0.05)',
  },
});
