import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddRounded as AddIcon,
  CheckRounded as CheckIcon,
  ContentCopyRounded as CopyIcon,
  DeleteOutlineRounded as DeleteIcon,
  ExpandMoreRounded as ExpandIcon,
  MoreVertRounded as MoreIcon,
  TimerOutlined as TimerIcon,
} from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import type { SessionExercise, SetRecord } from '../../../types';
import { ExerciseArtwork } from '../../../components/WorkoutArtwork';

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
}

export function ExerciseCard({ sessionExercise }: ExerciseCardProps) {
  const updateSet = useSessionStore(state => state.updateSet);
  const addSet = useSessionStore(state => state.addSet);
  const toggleSetCompleted = useSessionStore(state => state.toggleSetCompleted);
  const removeExercise = useSessionStore(state => state.removeExercise);
  const startRestTimer = useSessionStore(state => state.startRestTimer);
  const restTimer = useSessionStore(state => state.restTimer);
  const restTimerExerciseId = useSessionStore(state => state.restTimerExerciseId);
  const isRestTimerActive = useSessionStore(state => state.isRestTimerActive);
  const stopRestTimer = useSessionStore(state => state.stopRestTimer);

  const [isExpanded, setIsExpanded] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const sets = sessionExercise.sets || [];
  const completedCount = sets.filter(set => Boolean(set.completedAt)).length;
  const showRestTimer = isRestTimerActive && restTimerExerciseId === sessionExercise.id;

  const handleSetToggle = (setId: string, completed: boolean) => {
    toggleSetCompleted(sessionExercise.id, setId);
    if (!completed) startRestTimer(75, sessionExercise.id);
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleDeleteExercise = () => {
    removeExercise(sessionExercise.id);
    setAnchorEl(null);
  };

  return (
    <Card
      data-testid={`exercise-card-${sessionExercise.exerciseId}`}
      sx={{
        mb: 0.75,
        overflow: 'hidden',
        borderRadius: '7px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        '&:hover': { transform: 'none', boxShadow: 'none' },
      }}
    >
      <Box
        onClick={() => setIsExpanded(value => !value)}
        sx={{
          minHeight: 70,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.7,
          cursor: 'pointer',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ width: 72, flexShrink: 0, display: 'grid', placeItems: 'center', color: 'text.primary' }}>
          <ExerciseArtwork
            exerciseId={sessionExercise.exerciseId}
            exerciseName={sessionExercise.exerciseName}
            type={sessionExercise.type}
            size={68}
          />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              color: 'text.primary',
              fontSize: '0.92rem',
              fontWeight: 900,
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {sessionExercise.exerciseName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.55 }}>
            <Typography
              component="span"
              sx={{
                px: 0.7,
                py: 0.15,
                borderRadius: '4px',
                bgcolor: 'rgba(5,169,120,0.08)',
                color: '#07966d',
                fontSize: '0.67rem',
                fontWeight: 700,
              }}
            >
              {getMuscleLabel(sessionExercise)}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.67rem' }}>
              {completedCount}/{sets.length} 组
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.4, color: 'text.secondary', mr: 0.15 }}>
            <TimerIcon sx={{ fontSize: 19 }} />
            <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>休息 75 秒</Typography>
          </Box>
          <IconButton size="small" onClick={handleOpenMenu} sx={{ color: 'text.secondary' }}>
            <MoreIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <ExpandIcon
            sx={{
              color: 'text.secondary',
              fontSize: 22,
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 180ms ease',
            }}
          />
        </Box>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleDeleteExercise} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="删除该动作" />
        </MenuItem>
      </Menu>

      {isExpanded && (
        <Box sx={{ px: 1.25, pb: 1.25, animation: 'todaySectionReveal 180ms ease-out' }}>
          <Box sx={{ height: '1px', bgcolor: 'divider', mb: 0.4 }} />
          <TableHeader />
          {sets.map(set => (
            <SetRow
              key={set.id}
              set={set}
              onToggle={() => handleSetToggle(set.id, Boolean(set.completedAt))}
              onUpdate={updates => updateSet(sessionExercise.id, set.id, updates)}
            />
          ))}

          {showRestTimer && (
            <Box
              sx={{
                mt: 0.75,
                minHeight: 58,
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: 1,
                px: 1.4,
                borderRadius: '7px',
                bgcolor: 'rgba(5,169,120,0.07)',
                color: '#078c66',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
                <TimerIcon sx={{ fontSize: 22 }} />
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 800 }}>休息中</Typography>
              </Box>
              <Typography sx={{ fontSize: '1.72rem', lineHeight: 1, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {formatRestTime(restTimer)}
              </Typography>
              <Button
                data-testid="rest-timer-close-button"
                variant="outlined"
                onClick={stopRestTimer}
                sx={{
                  justifySelf: 'end',
                  minWidth: 66,
                  minHeight: 36,
                  borderWidth: '1px !important',
                  borderColor: '#06a878',
                  borderRadius: '6px',
                  color: '#078c66',
                  fontSize: '0.8rem',
                }}
              >
                跳过
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25, mt: 0.55 }}>
            <Button
              data-testid="copy-last-set-button"
              size="small"
              startIcon={<CopyIcon />}
              onClick={() => {
                const last = sets[sets.length - 1];
                if (last) addSet(sessionExercise.id, { weight: last.weight, reps: last.reps });
              }}
              sx={actionButtonStyle}
            >
              复制上组
            </Button>
            <Button
              data-testid="add-set-button"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => addSet(sessionExercise.id, { weight: 0, reps: 12 })}
              sx={actionButtonStyle}
            >
              添加组
            </Button>
          </Box>
        </Box>
      )}
    </Card>
  );
}

function TableHeader() {
  return (
    <Box sx={tableGridStyle}>
      {['组', '重量 (kg)', '次数 (次)', '完成'].map(label => (
        <Typography key={label} sx={{ color: 'text.secondary', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>
          {label}
        </Typography>
      ))}
    </Box>
  );
}

function SetRow({ set, onToggle, onUpdate }: {
  set: SetRecord;
  onToggle: () => void;
  onUpdate: (updates: Partial<SetRecord>) => void;
}) {
  const isCompleted = Boolean(set.completedAt);

  return (
    <Box
      sx={{
        ...tableGridStyle,
        minHeight: 48,
        py: 0.55,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: isCompleted ? 'rgba(5,169,120,0.055)' : 'transparent',
        borderRadius: isCompleted ? '7px' : 0,
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          placeSelf: 'center',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          bgcolor: isCompleted ? '#05a978' : '#e8ebf0',
          color: isCompleted ? '#fff' : 'text.secondary',
          fontSize: '0.82rem',
          fontWeight: 900,
        }}
      >
        {set.setNumber}
      </Box>
      <TextField
        data-testid={`set-${set.setNumber}-weight-input`}
        size="small"
        value={set.weight || ''}
        type="number"
        onChange={event => onUpdate({ weight: Number(event.target.value) })}
        sx={inputStyle(isCompleted)}
        inputProps={{ 'aria-label': `第 ${set.setNumber} 组重量`, style: { textAlign: 'center', fontWeight: 800 } }}
      />
      <TextField
        data-testid={`set-${set.setNumber}-reps-input`}
        size="small"
        value={set.reps || ''}
        type="number"
        onChange={event => onUpdate({ reps: Number(event.target.value) })}
        sx={inputStyle(isCompleted)}
        inputProps={{ 'aria-label': `第 ${set.setNumber} 组次数`, style: { textAlign: 'center', fontWeight: 800 } }}
      />
      <IconButton
        data-testid={`set-${set.setNumber}-complete-button`}
        aria-label={`完成第 ${set.setNumber} 组`}
        onClick={onToggle}
        sx={{
          width: 52,
          height: 34,
          placeSelf: 'center',
          borderRadius: '6px',
          bgcolor: isCompleted ? '#05a978' : 'transparent',
          border: isCompleted ? '1px solid #05a978' : '1.5px solid #d7dbe2',
          color: isCompleted ? '#fff' : 'transparent',
          '&:hover': { bgcolor: isCompleted ? '#058f68' : 'rgba(5,169,120,0.05)' },
        }}
      >
        {isCompleted && <CheckIcon sx={{ fontSize: 24 }} />}
      </IconButton>
    </Box>
  );
}

function getMuscleLabel(exercise: SessionExercise) {
  const value = `${exercise.exerciseId} ${exercise.exerciseName}`;
  if (/胸|press|fly|push-up/i.test(value)) return '胸大肌';
  if (/背|pull|row|划船|下拉|引体/i.test(value)) return '背阔肌';
  if (/肩|raise|delt/i.test(value)) return '三角肌';
  if (/弯举|curl|二头/i.test(value)) return '肱二头';
  if (/三头|屈伸|pushdown/i.test(value)) return '肱三头';
  if (/腿|蹲|squat|deadlift|臀/i.test(value)) return '下肢';
  return '目标肌群';
}

function formatRestTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${secs}`;
}

const tableGridStyle = {
  display: 'grid',
  gridTemplateColumns: '36px minmax(64px, 1fr) minmax(62px, 1fr) 58px',
  alignItems: 'center',
  gap: 0.65,
  px: 0.2,
  py: 0.7,
};

const inputStyle = (isCompleted: boolean) => ({
  minWidth: 0,
  '& .MuiOutlinedInput-root': {
    height: 36,
    borderRadius: '6px',
    bgcolor: isCompleted ? 'rgba(255,255,255,0.78)' : 'background.paper',
    fontSize: '0.86rem',
    '& fieldset': { borderWidth: '1px', borderColor: '#d8dce3' },
  },
  '& input': { minWidth: 0, px: 0.5, py: 0.7 },
});

const actionButtonStyle = {
  minHeight: 30,
  px: 1,
  color: 'text.secondary',
  fontSize: '0.68rem',
  fontWeight: 700,
  '&:hover': { color: '#078c66', bgcolor: 'rgba(5,169,120,0.04)', boxShadow: 'none', transform: 'none' },
};
