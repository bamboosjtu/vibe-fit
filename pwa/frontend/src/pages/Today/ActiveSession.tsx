import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  List,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Timer as TimerIcon,
} from '@mui/icons-material';
import { useSessionStore, useSettingsStore } from '../../stores';
import { ExerciseSelector } from '../../components/ExerciseSelector';
import { SetInput } from '../../components/SetInput';
import { calculateSessionDuration } from '../../utils/helpers';
import type { Exercise } from '../../types';

export function ActiveSession() {
  const {
    activeSession,
    endSession,
    cancelSession,
    addExercise,
    removeExercise,
    addSet,
    updateSet,
    deleteSet,
    copyLastSet,
  } = useSessionStore();
  
  const { weightUnit } = useSettingsStore();
  
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [notes, setNotes] = useState('');

  if (!activeSession) return null;

  const duration = calculateSessionDuration(activeSession.startedAt);

  const handleEnd = async () => {
    await endSession(notes);
    setShowEndDialog(false);
  };

  const handleAddExercise = (exercise: Exercise) => {
    addExercise(exercise);
    setShowExerciseSelector(false);
  };

  return (
    <Box sx={{ p: 2, pb: 10 }}>
      {/* 头部信息 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">
          {activeSession.dayName || '自由训练'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TimerIcon fontSize="small" />
          <Typography variant="h6">
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </Typography>
        </Box>
      </Box>

      {activeSession.exercises.length === 0 ? (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography color="text.secondary" align="center">
              点击右下角按钮添加动作
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <List sx={{ pb: 8 }}>
          {activeSession.exercises.map((exercise) => (
            <Card key={exercise.id} sx={{ mb: 2 }}>
              <CardContent>
                {/* 动作标题 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6">
                      {exercise.exerciseName}
                    </Typography>
                    <Chip 
                      size="small" 
                      label={exercise.type === 'strength' ? '力量' : '有氧'} 
                      color={exercise.type === 'strength' ? 'primary' : 'secondary'}
                    />
                  </Box>
                  <IconButton 
                    color="error" 
                    onClick={() => removeExercise(exercise.id)}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>

                {/* 组记录 */}
                {exercise.sets.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    {exercise.sets.map((set) => (
                      <SetInput
                        key={set.id}
                        set={set}
                        exerciseType={exercise.type}
                        weightUnit={weightUnit}
                        onUpdate={(updates) => updateSet(exercise.id, set.id, updates)}
                        onDelete={() => deleteSet(exercise.id, set.id)}
                      />
                    ))}
                  </Box>
                )}

                {/* 添加组按钮 */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => addSet(exercise.id, {})}
                    fullWidth
                  >
                    添加组
                  </Button>
                  {exercise.sets.length > 0 && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CopyIcon />}
                      onClick={() => copyLastSet(exercise.id)}
                      fullWidth
                    >
                      复制上一组
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </List>
      )}

      {/* 底部操作栏 */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 80,
          left: 0,
          right: 0,
          p: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          gap: 2,
          zIndex: 100,
        }}
      >
        <Button
          variant="outlined"
          color="error"
          onClick={() => setShowCancelDialog(true)}
          fullWidth
        >
          放弃
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => setShowEndDialog(true)}
          fullWidth
          disabled={activeSession.exercises.length === 0}
        >
          完成训练
        </Button>
      </Box>

      {/* 添加动作按钮 */}
      <Fab
        color="primary"
        sx={{ position: 'fixed', bottom: 160, right: 16 }}
        onClick={() => setShowExerciseSelector(true)}
      >
        <AddIcon />
      </Fab>

      {/* 动作选择器 */}
      <ExerciseSelector
        open={showExerciseSelector}
        onClose={() => setShowExerciseSelector(false)}
        onSelect={handleAddExercise}
      />

      {/* 结束训练对话框 */}
      <Dialog
        open={showEndDialog}
        onClose={() => setShowEndDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>完成训练</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            训练时长: {Math.floor(duration / 60)}分{duration % 60}秒
          </Typography>
          <TextField
            label="训练笔记（可选）"
            multiline
            rows={3}
            fullWidth
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndDialog(false)}>取消</Button>
          <Button onClick={handleEnd} variant="contained" color="success">
            确认完成
          </Button>
        </DialogActions>
      </Dialog>

      {/* 放弃训练对话框 */}
      <Dialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
      >
        <DialogTitle>放弃训练?</DialogTitle>
        <DialogContent>
          <Typography>
            确定要放弃本次训练吗？所有记录将丢失。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCancelDialog(false)}>取消</Button>
          <Button onClick={cancelSession} color="error">
            放弃
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
