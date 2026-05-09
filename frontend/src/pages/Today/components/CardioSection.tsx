import { Box, Typography, Card, CardContent, Button, Chip, IconButton, TextField } from '@mui/material';
import { 
  PlayArrow as PlayIcon, 
  Pause as PauseIcon, 
  Check as CheckIcon, 
  MoreVert as MoreIcon 
} from '@mui/icons-material';
import { useState } from 'react';

interface CardioData {
  id: string;
  exerciseId: string;
  name: string;
  icon: string;
  lastRecord?: string;
  duration: string;
  incline: string;
  speed: string;
  calories: string;
  isActive: boolean;
  isPaused: boolean;
}

export function CardioSection() {
  const [cardioExercises, setCardioExercises] = useState<CardioData[]>([
    { id: 'c1', exerciseId: 'treadmill', name: '跑步机', icon: '🏃', lastRecord: '上次：30分钟 · 坡度 2.0', duration: '30', incline: '2.0', speed: '8.5', calories: '320', isActive: false, isPaused: false },
    { id: 'c2', exerciseId: 'elliptical', name: '椭圆机', icon: '👟', lastRecord: '', duration: '25', incline: '8', speed: '', calories: '', isActive: false, isPaused: false },
    { id: 'c3', exerciseId: 'rowing-machine', name: '划船机', icon: '🚣', lastRecord: '上次：2000米 · 8:45', duration: '', incline: '', speed: '', calories: '', isActive: false, isPaused: false },
  ]);

  const handleStart = (id: string) => {
    setCardioExercises(prev => prev.map(c => ({ ...c, isActive: c.id === id, isPaused: false })));
  };

  const handleTogglePause = (id: string) => {
    setCardioExercises(prev => prev.map(c => c.id === id ? { ...c, isPaused: !c.isPaused } : c));
  };

  const handleChange = (id: string, field: keyof CardioData, value: string) => {
    setCardioExercises(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <Box>
      {cardioExercises.map((cardio) => (
        <Card 
          key={cardio.id} 
          sx={{ 
            mb: 2, borderRadius: '16px', border: cardio.isActive ? '2px solid' : '1px solid',
            borderColor: cardio.isActive ? 'primary.main' : 'divider',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: '12px',
                  background: cardio.isActive ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' : 'rgba(16, 185, 129, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                }}>
                  {cardio.icon}
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold">{cardio.name}</Typography>
                  {cardio.isActive && <Chip size="small" label="进行中" sx={{ height: 20, bgcolor: 'rgba(16, 185, 129, 0.1)', color: 'primary.main', fontWeight: 600, fontSize: '0.7rem' }} />}
                  {cardio.lastRecord && !cardio.isActive && <Typography variant="caption" color="text.secondary">{cardio.lastRecord}</Typography>}
                </Box>
              </Box>
              <IconButton size="small"><MoreIcon /></IconButton>
            </Box>

            {cardio.isActive ? (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2, p: 2, bgcolor: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px' }}>
                  <CardioInput label="时长(min)" value={cardio.duration} onChange={(v) => handleChange(cardio.id, 'duration', v)} />
                  <CardioInput label="速度(km/h)" value={cardio.speed} onChange={(v) => handleChange(cardio.id, 'speed', v)} />
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="outlined" fullWidth startIcon={<PauseIcon />} onClick={() => handleTogglePause(cardio.id)} color="warning">暂停</Button>
                  <Button variant="contained" fullWidth startIcon={<CheckIcon />} onClick={() => {}}>完成记录</Button>
                </Box>
              </>
            ) : (
              <Button variant="contained" fullWidth startIcon={<PlayIcon />} onClick={() => handleStart(cardio.id)} sx={{ background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)' }}>
                开始有氧
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

function CardioInput({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>{label}</Typography>
      <TextField
        size="small"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ width: 80, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'background.paper' } }}
        inputProps={{ style: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' } }}
      />
    </Box>
  );
}
