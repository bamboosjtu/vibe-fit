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
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { DEFAULT_EXERCISES } from '../constants/exercises';
import type { Exercise, ExerciseType } from '../types';

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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>选择动作</DialogTitle>
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

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredExercises.length === 0 ? (
            <ListItem>
              <ListItemText primary="没有找到匹配的动作" />
            </ListItem>
          ) : (
            filteredExercises.map((exercise) => (
              <ListItem key={exercise.id} disablePadding>
                <ListItemButton data-testid={`exercise-option-${exercise.id}`} onClick={() => handleSelect(exercise)}>
                  <ListItemText
                    primary={exercise.name}
                    secondary={exercise.muscleGroups?.join(', ')}
                  />
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>取消</Button>
      </DialogActions>
    </Dialog>
  );
}
