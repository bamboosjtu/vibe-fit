import { useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import type { SetRecord, ExerciseType, WeightUnit } from '../types';

interface SetInputProps {
  set: SetRecord;
  exerciseType: ExerciseType;
  weightUnit: WeightUnit;
  onUpdate: (updates: Partial<SetRecord>) => void;
  onDelete: () => void;
}

export function SetInput({ set, exerciseType, weightUnit, onUpdate, onDelete }: SetInputProps) {
  const [localWeight, setLocalWeight] = useState(set.weight?.toString() || '');
  const [localReps, setLocalReps] = useState(set.reps?.toString() || '');
  const [localDuration, setLocalDuration] = useState(set.duration?.toString() || '');
  const [localDistance, setLocalDistance] = useState(set.distance?.toString() || '');
  const [localRpe, setLocalRpe] = useState(set.rpe?.toString() || '');

  const handleWeightChange = (value: string) => {
    setLocalWeight(value);
    const num = parseFloat(value);
    onUpdate({ weight: isNaN(num) ? undefined : num });
  };

  const handleRepsChange = (value: string) => {
    setLocalReps(value);
    const num = parseInt(value, 10);
    onUpdate({ reps: isNaN(num) ? undefined : num });
  };

  const handleDurationChange = (value: string) => {
    setLocalDuration(value);
    const num = parseInt(value, 10);
    onUpdate({ duration: isNaN(num) ? undefined : num });
  };

  const handleDistanceChange = (value: string) => {
    setLocalDistance(value);
    const num = parseFloat(value);
    onUpdate({ distance: isNaN(num) ? undefined : num });
  };

  const handleRpeChange = (value: string) => {
    setLocalRpe(value);
    const num = parseInt(value, 10);
    onUpdate({ rpe: isNaN(num) ? undefined : Math.min(10, Math.max(1, num)) });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        bgcolor: 'action.hover',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <Typography variant="body2" sx={{ minWidth: 30, fontWeight: 'bold' }}>
        {set.setNumber}
      </Typography>

      {exerciseType === 'strength' ? (
        <>
          <TextField
            size="small"
            type="number"
            label="重量"
            value={localWeight}
            onChange={(e) => handleWeightChange(e.target.value)}
            sx={{ width: 90 }}
            InputProps={{
              endAdornment: <Typography variant="caption">{weightUnit}</Typography>,
            }}
          />
          <TextField
            size="small"
            type="number"
            label="次数"
            value={localReps}
            onChange={(e) => handleRepsChange(e.target.value)}
            sx={{ width: 80 }}
          />
        </>
      ) : (
        <>
          <TextField
            size="small"
            type="number"
            label="时长"
            value={localDuration}
            onChange={(e) => handleDurationChange(e.target.value)}
            sx={{ width: 100 }}
            InputProps={{
              endAdornment: <Typography variant="caption">分</Typography>,
            }}
          />
          <TextField
            size="small"
            type="number"
            label="距离"
            value={localDistance}
            onChange={(e) => handleDistanceChange(e.target.value)}
            sx={{ width: 100 }}
          />
        </>
      )}

      <TextField
        size="small"
        type="number"
        label="RPE"
        value={localRpe}
        onChange={(e) => handleRpeChange(e.target.value)}
        sx={{ width: 70 }}
        inputProps={{ min: 1, max: 10 }}
      />

      <IconButton size="small" color="error" onClick={onDelete}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
