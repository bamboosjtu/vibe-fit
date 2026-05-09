import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useSessionStore } from '../../../stores';

export function ExtraExercises() {
  const { activeSession, removeExercise } = useSessionStore();

  const extraExercises = activeSession?.exercises.filter(() => {
    // 占位逻辑
    return false;
  }) || [];

  if (extraExercises.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box sx={{
          width: 32, height: 32, borderRadius: '8px',
          background: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
        }}>
          ⚡
        </Box>
        <Typography variant="h5" fontWeight="bold">加练</Typography>
      </Box>
      
      {extraExercises.map((ex) => (
        <Box key={ex.id} sx={{ position: 'relative' }}>
          <IconButton 
            size="small" 
            onClick={() => removeExercise(ex.id)}
            sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}
