import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Box, 
  Typography, 
  IconButton, 
  TextField, 
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  ExpandMore as ChevronDownIcon, 
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import type { SessionExercise, SetRecord } from '../../../types';
import { ExerciseArtwork } from '../../../components/WorkoutArtwork';

interface ExerciseCardProps {
  sessionExercise: SessionExercise;
}

export function ExerciseCard({ sessionExercise }: ExerciseCardProps) {
  const { updateSet, addSet, toggleSetCompleted, deleteSet, removeExercise, startRestTimer } = useSessionStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const sets = sessionExercise.sets || [];

  const handleToggleExpand = () => setIsExpanded(!isExpanded);

  const handleSetToggle = (setId: string, completed: boolean) => {
    toggleSetCompleted(sessionExercise.id, setId);
    if (!completed) {
      // 如果是完成操作，开启休息计时器（默认60秒）
      startRestTimer(60);
    }
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleDeleteExercise = () => {
    removeExercise(sessionExercise.id);
    handleCloseMenu();
  };

  const getSummary = () => {
    const completedCount = sets.filter(s => !!s.completedAt).length;
    const totalCount = sets.length;
    if (totalCount === 0) return '尚未记录';
    if (completedCount === totalCount) {
      const lastSet = sets[sets.length - 1];
      return `完成：${lastSet.weight || 0}kg × ${lastSet.reps || 0}`;
    }
    return `已完成 ${completedCount} / ${totalCount} 组`;
  };

  return (
    <Card
      data-testid={`exercise-card-${sessionExercise.exerciseId}`}
      sx={{
        mb: 1.5,
        borderRadius: '12px',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.07)',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ p: 1.5, pb: isExpanded ? 1.5 : 1 }}>
        {/* Card Header */}
        <Box
          onClick={handleToggleExpand}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
        >
          <Box sx={{ flexShrink: 0, color: 'text.primary' }}>
            <ExerciseArtwork
              exerciseId={sessionExercise.exerciseId}
              exerciseName={sessionExercise.exerciseName}
              type={sessionExercise.type}
              size={64}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1rem', fontFamily: 'var(--font-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sessionExercise.exerciseName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {getSummary()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton 
              size="small" 
              onClick={handleOpenMenu}
              sx={{ color: 'text.secondary' }}
            >
              <MoreIcon fontSize="small" />
            </IconButton>
            <IconButton 
              size="small" 
              sx={{ 
                transition: 'transform 0.2s ease',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              <ChevronDownIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Header Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseMenu}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={handleDeleteExercise} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText primary="删除该动作" />
          </MenuItem>
        </Menu>

        {/* Sets Table */}
        {isExpanded && (
          <Box sx={{ mt: 1.25 }}>
            <TableHeader />
            {sets.map((set) => (
              <SetRow 
                key={set.id} 
                set={set} 
                onToggle={() => handleSetToggle(set.id, !!set.completedAt)}
                onUpdate={(updates) => updateSet(sessionExercise.id, set.id, updates)}
                onDelete={() => deleteSet(sessionExercise.id, set.id)}
              />
            ))}
            
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                data-testid="copy-last-set-button"
                size="small"
                variant="outlined"
                fullWidth
                startIcon={<CopyIcon />}
                onClick={() => {
                   if (sets.length > 0) {
                     const last = sets[sets.length-1];
                     addSet(sessionExercise.id, { weight: last.weight, reps: last.reps });
                   }
                }}
                sx={actionButtonStyle}
              >
                复制上组
              </Button>
              <Button
                data-testid="add-set-button"
                size="small"
                variant="outlined"
                fullWidth
                startIcon={<AddIcon />}
                onClick={() => addSet(sessionExercise.id, { weight: 0, reps: 12 })}
                sx={actionButtonStyle}
              >
                添加组
              </Button>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function TableHeader() {
  return (
    <Box sx={{ 
      display: 'grid', gridTemplateColumns: '34px minmax(74px, 1fr) minmax(70px, 1fr) 54px 34px', gap: 0.5, mb: 0.75, px: 0.5, py: 0.5,
      bgcolor: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px'
    }}>
      {['组', '重量', '次数', '✓', ''].map((label, i) => (
        <Typography key={i} variant="caption" sx={{ textAlign: 'center', fontWeight: 700, color: 'text.secondary', fontSize: '0.7rem' }}>
          {label}
        </Typography>
      ))}
    </Box>
  );
}

function SetRow({ set, onToggle, onUpdate, onDelete }: { 
  set: SetRecord, 
  onToggle: () => void, 
  onUpdate: (u: Partial<SetRecord>) => void,
  onDelete: () => void
}) {
  const isCompleted = !!set.completedAt;
  return (
    <Box sx={{ 
      display: 'grid', gridTemplateColumns: '34px minmax(74px, 1fr) minmax(70px, 1fr) 54px 34px', gap: 0.5, px: 0.5, py: 0.65, mb: 0.5,
      bgcolor: isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
      borderRadius: '8px', border: '1px solid', borderColor: isCompleted ? 'success.light' : 'divider',
    }}>
      <Typography sx={{ textAlign: 'center', fontWeight: 700, color: isCompleted ? 'success.main' : 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {set.setNumber}
      </Typography>
      <TextField
        data-testid={`set-${set.setNumber}-weight-input`}
        size="small"
        value={set.weight || ''}
        type="number"
        onChange={(e) => onUpdate({ weight: Number(e.target.value) })}
        sx={inputStyle(isCompleted)}
        inputProps={{ style: { textAlign: 'center', fontWeight: 'bold' } }}
      />
      <TextField
        data-testid={`set-${set.setNumber}-reps-input`}
        size="small"
        value={set.reps || ''}
        type="number"
        onChange={(e) => onUpdate({ reps: Number(e.target.value) })}
        sx={inputStyle(isCompleted)}
        inputProps={{ style: { textAlign: 'center', fontWeight: 'bold' } }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <IconButton data-testid={`set-${set.setNumber}-complete-button`} size="small" onClick={onToggle} sx={{
        width: 46, height: 34,
        borderRadius: '8px',
          background: isCompleted ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' : 'transparent',
          border: isCompleted ? 'none' : '2px solid #E5E7EB',
          color: isCompleted ? 'white' : 'transparent',
          '&:hover': { background: isCompleted ? 'linear-gradient(135deg, #059669 0%, #0891B2 100%)' : 'rgba(16, 185, 129, 0.1)' }
        }}>
          {isCompleted && <CheckIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <IconButton size="small" onClick={onDelete} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
          <DeleteIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </Box>
  );
}

const inputStyle = (isCompleted: boolean) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    height: 36,
    bgcolor: isCompleted ? 'rgba(16, 185, 129, 0.05)' : 'background.paper',
    fontSize: '0.875rem',
  },
  '& input': { padding: '8px' },
});

const actionButtonStyle = {
  borderRadius: '8px', py: 0.85, borderWidth: 1.5, borderColor: 'primary.light', color: 'primary.main',
  fontWeight: 800, fontSize: '0.75rem',
  '&:hover': { borderWidth: 1.5, borderColor: 'primary.main', bgcolor: 'rgba(16, 185, 129, 0.05)' },
};
