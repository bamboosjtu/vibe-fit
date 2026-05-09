import { Box, Typography, Chip, IconButton, Button } from '@mui/material';
import { MoreVert as MoreIcon, Add as AddIcon } from '@mui/icons-material';
import type { TrainingPhase, TrainingDay, ExerciseGroup } from '../../../types';
import { ExerciseCard } from './ExerciseCard';
import { useSessionStore } from '../../../stores';

interface StrengthSectionProps {
  todayDay: TrainingDay | null;
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void;
}

export function StrengthSection({ todayDay, onOpenGroupSelector }: StrengthSectionProps) {
  if (!todayDay || !todayDay.phases || todayDay.phases.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          今日没有力量训练安排
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {todayDay.phases.map((phase, phaseIndex) => (
        <PhaseSection 
          key={phase.id} 
          phase={phase} 
          phaseIndex={phaseIndex} 
          onOpenGroupSelector={onOpenGroupSelector}
        />
      ))}
    </Box>
  );
}

function PhaseSection({ phase, phaseIndex, onOpenGroupSelector }: { 
  phase: TrainingPhase, 
  phaseIndex: number, 
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void 
}) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2,
        p: 2,
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid',
        borderColor: 'divider',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontFamily: '"Poppins", sans-serif',
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            {phaseIndex + 1}
          </Box>
          <Typography variant="h6" fontWeight="bold" sx={{ fontFamily: '"Poppins", sans-serif' }}>
            {phase.name}
          </Typography>
        </Box>
        <IconButton size="small"><MoreIcon /></IconButton>
      </Box>

      {phase.groups.map((group) => (
        <GroupSection key={group.id} phaseId={phase.id} group={group} onOpenGroupSelector={onOpenGroupSelector} />
      ))}
    </Box>
  );
}

function GroupSection({ phaseId, group, onOpenGroupSelector }: { 
  phaseId: string,
  group: ExerciseGroup, 
  onOpenGroupSelector: (phaseId: string, group: ExerciseGroup) => void 
}) {
  const activeSession = useSessionStore(state => state.activeSession);
  
  // 从 session 中获取属于该 group 的动作
  // 增加 legacy 兼容性：如果动作没有 groupId，但 exerciseId 在该 group 的 availableExercises 中，也尝试匹配
  const sessionExercises = activeSession?.exercises.filter(ex => {
    if (ex.groupId === group.id) return true;
    if (ex.groupId === 'legacy' || !ex.groupId) {
       return group.availableExercises.some(ae => ae.exerciseId === ex.exerciseId);
    }
    return false;
  }) || [];

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ mb: 1.5 }}>
        <Chip 
          size="small" 
          label={`${group.name}类`}
          sx={{ 
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
            color: 'primary.dark',
            fontWeight: 700,
            fontSize: '0.75rem',
            fontFamily: '"Nunito", sans-serif',
            border: '1px solid',
            borderColor: 'primary.light',
          }}
        />
      </Box>
      
      <Box>
        {sessionExercises.map((ex) => (
          <ExerciseCard 
            key={ex.id} 
            sessionExercise={ex} 
          />
        ))}
      </Box>
      
      <Button
        variant="outlined"
        fullWidth
        startIcon={<AddIcon />}
        onClick={() => onOpenGroupSelector(phaseId, group)}
        sx={{ 
          borderRadius: '12px', 
          py: 1.5, 
          mb: 2,
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: 'primary.light',
          color: 'primary.main',
          justifyContent: 'flex-start',
          pl: 2,
          fontWeight: 600,
          '&:hover': {
            borderWidth: 2,
            borderColor: 'primary.main',
            bgcolor: 'rgba(16, 185, 129, 0.05)',
          },
        }}
      >
        {sessionExercises.length > 0 
          ? `从"${group.name}类"选择第 ${sessionExercises.length + 1} 个动作`
          : `从"${group.name}类"选择动作`
        }
      </Button>
    </Box>
  );
}
