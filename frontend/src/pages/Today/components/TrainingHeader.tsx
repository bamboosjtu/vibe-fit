import { Box, Typography, Paper, Tabs, Tab } from '@mui/material';
import { Timer as TimerIcon } from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { useEffect } from 'react';

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
    <Box sx={{ p: 2, pb: 1.5, bgcolor: 'background.default', flexShrink: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="h5" 
            fontWeight="bold"
            sx={{
              fontFamily: '"Poppins", sans-serif',
              background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.2,
            }}
          >
            今日训练
          </Typography>
          
          {dayName && (
            <Typography 
              variant="body2" 
              sx={{ 
                fontFamily: '"Poppins", sans-serif',
                fontWeight: 600,
                color: 'text.primary',
                mt: 0.5,
              }}
            >
              {dayName}
            </Typography>
          )}
        </Box>
        
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: '12px',
            bgcolor: 'background.paper',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TimerIcon sx={{ fontSize: '1.2rem', color: 'primary.main' }} />
          <Typography 
            variant="h6" 
            fontWeight="bold"
            sx={{
              fontFamily: '"Poppins", sans-serif',
              color: 'primary.main',
              minWidth: '60px',
            }}
          >
            {formatTime(trainingTimer)}
          </Typography>
        </Box>
      </Box>

      <Paper 
        sx={{ 
          borderRadius: '12px', 
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: '0 2px 12px rgba(16, 185, 129, 0.08)',
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
            value="strength"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>💪</span>
                <span>力量训练</span>
              </Box>
            }
            sx={tabStyle(trainingMode === 'strength', '#10B981', '#06B6D4')}
          />
          <Tab
            value="cardio"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>🏃</span>
                <span>有氧训练</span>
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
  borderRadius: '12px',
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
