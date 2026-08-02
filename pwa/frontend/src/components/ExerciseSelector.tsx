import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tabs,
  Tab,
  InputAdornment,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import { Search as SearchIcon, ExpandMoreRounded as ExpandIcon } from '@mui/icons-material';
import { DEFAULT_EXERCISES } from '../constants/exercises';
import type { Exercise, ExerciseType, ExerciseGroup } from '../types';
import { ExerciseArtwork } from './WorkoutArtwork';

interface ExerciseSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  /** 当前动作组上下文。传入时进入 group-select 模式，仅展示推荐动作 */
  group?: ExerciseGroup;
}

const CATEGORIES: { value: ExerciseType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'strength', label: '力量' },
  { value: 'cardio', label: '有氧' },
];

export function ExerciseSelector({ open, onClose, onSelect, group }: ExerciseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseType | 'all'>('all');
  const [showAllExercises, setShowAllExercises] = useState(false);

  // group-select 模式：从 group.availableExercises 匹配完整 Exercise 对象
  const recommendedExercises = useMemo<Exercise[]>(() => {
    if (!group?.availableExercises) return [];
    return group.availableExercises
      .map((config) => {
        // 优先按 exerciseId 匹配，其次按名称匹配
        return (
          DEFAULT_EXERCISES.find((ex) => ex.id === config.exerciseId) ??
          DEFAULT_EXERCISES.find((ex) => ex.name === config.exerciseName)
        );
      })
      .filter((ex): ex is Exercise => ex !== undefined);
  }, [group]);

  // library 模式或展开搜索时的全部动作
  const filteredAllExercises = useMemo(() => {
    return DEFAULT_EXERCISES.filter((exercise) => {
      const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || exercise.type === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const isGroupSelectMode = Boolean(group);

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    resetState();
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const resetState = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setShowAllExercises(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '18px 18px 0 0',
          m: 0,
          width: '100%',
          maxWidth: '100%',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '84dvh',
          bgcolor: 'background.paper',
        },
      }}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(15, 23, 42, 0.4)' },
        },
      }}
    >
      <DialogTitle sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Box sx={{ width: 42, height: 4, borderRadius: 999, bgcolor: 'divider', mx: 'auto', mb: 1.5 }} />
        <Typography component="div" variant="h6" sx={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          {isGroupSelectMode ? `选择${group!.name}动作` : '选择动作'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {isGroupSelectMode && !showAllExercises ? (
          /* group-select 模式：优先展示推荐动作 */
          <>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary', mb: 1, px: 0.5 }}>
              推荐
            </Typography>
            <List className="vf-scroll" sx={{ maxHeight: '48dvh', overflow: 'auto', px: 0.5 }}>
              {recommendedExercises.length === 0 ? (
                <ListItem>
                  <ListItemText primary="该组暂无推荐动作" />
                </ListItem>
              ) : (
                recommendedExercises.map((exercise) => (
                  <ExerciseOption key={exercise.id} exercise={exercise} onSelect={handleSelect} />
                ))
              )}
            </List>

            <Divider sx={{ my: 1.5 }} />

            <ListItem disablePadding>
              <ListItemButton
                data-testid="show-all-exercises-button"
                onClick={() => setShowAllExercises(true)}
                sx={{ borderRadius: '12px', py: 1.25, justifyContent: 'center', gap: 1 }}
              >
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.secondary' }}>
                  搜索更多动作
                </Typography>
                <ExpandIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          /* library 模式或展开搜索全部动作 */
          <>
            {isGroupSelectMode && (
              <Button
                size="small"
                onClick={() => {
                  setShowAllExercises(false);
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                sx={{ mb: 1, color: 'text.secondary', fontSize: '0.78rem' }}
              >
                ← 返回推荐
              </Button>
            )}
            <TextField
              data-testid="exercise-search-input"
              fullWidth
              placeholder="搜索动作..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Tabs
              value={selectedCategory}
              onChange={(_, value) => setSelectedCategory(value)}
              sx={{ mb: 2 }}
            >
              {CATEGORIES.map((cat) => (
                <Tab key={cat.value} value={cat.value} label={cat.label} />
              ))}
            </Tabs>

            <List className="vf-scroll" sx={{ maxHeight: '48dvh', overflow: 'auto', px: 0.5 }}>
              {filteredAllExercises.length === 0 ? (
                <ListItem>
                  <ListItemText primary="没有找到匹配的动作" />
                </ListItem>
              ) : (
                filteredAllExercises.map((exercise) => (
                  <ExerciseOption key={exercise.id} exercise={exercise} onSelect={handleSelect} />
                ))
              )}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

function ExerciseOption({ exercise, onSelect }: { exercise: Exercise; onSelect: (ex: Exercise) => void }) {
  return (
    <ListItem key={exercise.id} disablePadding>
      <ListItemButton
        data-testid={`exercise-option-${exercise.id}`}
        onClick={() => onSelect(exercise)}
        sx={{ borderRadius: '12px', mb: 0.75, alignItems: 'center', gap: 1.25, py: 1 }}
      >
        <Box sx={{ color: 'text.primary', flexShrink: 0 }}>
          <ExerciseArtwork
            exerciseId={exercise.id}
            exerciseName={exercise.name}
            type={exercise.type}
            muscleGroups={exercise.muscleGroups}
            size={52}
          />
        </Box>
        <ListItemText
          primary={exercise.name}
          secondary={exercise.muscleGroups?.join(', ')}
          primaryTypographyProps={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}
          secondaryTypographyProps={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem' }}
        />
      </ListItemButton>
    </ListItem>
  );
}
