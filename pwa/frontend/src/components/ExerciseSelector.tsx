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
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { DEFAULT_EXERCISES } from '../constants/exercises';
import type { Exercise, ExerciseType } from '../types';
import { ExerciseArtwork } from './WorkoutArtwork';

interface ExerciseSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
}

const CATEGORIES: { value: ExerciseType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'strength', label: '力量' },
  { value: 'cardio', label: '有氧' },
];

export function ExerciseSelector({ open, onClose, onSelect }: ExerciseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseType | 'all'>('all');

  const filteredExercises = useMemo(() => {
    return DEFAULT_EXERCISES.filter((exercise) => {
      const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || exercise.type === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleClose = () => {
    onClose();
    setSearchQuery('');
    setSelectedCategory('all');
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
          选择动作
        </Typography>
      </DialogTitle>
      <DialogContent>
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
          {filteredExercises.length === 0 ? (
            <ListItem>
              <ListItemText primary="没有找到匹配的动作" />
            </ListItem>
          ) : (
            filteredExercises.map((exercise) => (
              <ListItem key={exercise.id} disablePadding>
                <ListItemButton
                  data-testid={`exercise-option-${exercise.id}`}
                  onClick={() => handleSelect(exercise)}
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
            ))
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
