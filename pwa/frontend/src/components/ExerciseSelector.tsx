import { useState, useMemo } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
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
  Chip,
} from '@mui/material';
import { Search as SearchIcon, ExpandMoreRounded as ExpandIcon, Check as CheckIcon } from '@mui/icons-material';
import { DEFAULT_EXERCISES } from '../constants/exercises';
import type { Exercise, ExerciseType, ExerciseGroup, PlanExerciseConfig } from '../types';
import { ExerciseImage } from './ExerciseImage';

/**
 * 显式上下文：禁止根据页面状态自行推断。
 * 调用方必须传入 phaseId/groupId，以及已添加动作 id 列表用于去重。
 */
export interface SelectorContext {
  phaseId: string;
  groupId: string;
  groupName: string;
  group: ExerciseGroup;
  /** 当前组已添加的 exerciseId 列表，用于去重 */
  addedExerciseIds: string[];
}

interface ExerciseSelectorProps {
  open: boolean;
  onClose: () => void;
  /**
   * 添加动作回调。
   * - source: 'recommended' 表示从推荐列表添加，'library' 表示从全局搜索添加
   * - config: 推荐动作的计划配置（targetSets/targetReps/restSeconds），用于继承
   */
  onSelect: (
    exercise: Exercise,
    source: 'recommended' | 'library',
    config?: PlanExerciseConfig,
  ) => void;
  /** 当前动作组上下文。必填，禁止推断 */
  context: SelectorContext | null;
}

const CATEGORIES: { value: ExerciseType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'strength', label: '力量' },
  { value: 'cardio', label: '有氧' },
];

export function ExerciseSelector({ open, onClose, onSelect, context }: ExerciseSelectorProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseType | 'all'>('all');
  const [showAllExercises, setShowAllExercises] = useState(false);

  // 切换动作组或重新打开选择器时，清空筛选和搜索状态
  // 使用 React 推荐的"渲染期间调整 state"模式，避免在 effect 中 setState
  // 参考：https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevGroupId, setPrevGroupId] = useState<string | undefined>(context?.groupId);
  if (open !== prevOpen || context?.groupId !== prevGroupId) {
    setPrevOpen(open);
    setPrevGroupId(context?.groupId);
    if (open) {
      setSearchQuery('');
      setSelectedCategory('all');
      setShowAllExercises(false);
    }
  }

  // 推荐动作：严格来自 group.availableExercises，按 exerciseId 匹配完整 Exercise 对象
  const recommendedItems = useMemo(() => {
    if (!context?.group?.availableExercises) return [];
    return context.group.availableExercises
      .map((config) => {
        const exercise = DEFAULT_EXERCISES.find((ex) => ex.id === config.exerciseId);
        return exercise ? { exercise, config } : null;
      })
      .filter((item): item is { exercise: Exercise; config: PlanExerciseConfig } => item !== null);
  }, [context]);

  // 全局动作库（点击"搜索更多动作"后加载）
  const filteredAllExercises = useMemo(() => {
    return DEFAULT_EXERCISES.filter((exercise) => {
      const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || exercise.type === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const isGroupSelectMode = Boolean(context);
  const addedIds = new Set(context?.addedExerciseIds ?? []);

  const handleSelectRecommended = (exercise: Exercise, config: PlanExerciseConfig) => {
    if (addedIds.has(exercise.id)) return; // 已添加不可重复
    onSelect(exercise, 'recommended', config);
  };

  const handleSelectFromLibrary = (exercise: Exercise) => {
    if (addedIds.has(exercise.id)) return;
    onSelect(exercise, 'library');
  };

  const handleClose = () => {
    onClose();
  };

  // 桌面端：居中 Dialog；手机端：Bottom Sheet
  const paperSx = isDesktop
    ? {
        borderRadius: '18px',
        m: 0,
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        bgcolor: 'background.paper',
      }
    : {
        borderRadius: '18px 18px 0 0',
        m: 0,
        width: '100%',
        maxWidth: '100%',
        position: 'fixed' as const,
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '84dvh',
        bgcolor: 'background.paper',
      };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: paperSx }}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'rgba(15, 23, 42, 0.4)' } },
      }}
    >
      <DialogTitle sx={{ px: 2, pt: 1.5, pb: 1 }}>
        {!isDesktop && (
          <Box sx={{ width: 42, height: 4, borderRadius: 999, bgcolor: 'divider', mx: 'auto', mb: 1.5 }} />
        )}
        <Typography component="div" variant="h6" sx={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          {isGroupSelectMode ? `选择${context!.groupName}动作` : '选择动作'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ px: 2 }}>
        {isGroupSelectMode && !showAllExercises ? (
          /* 推荐列表 */
          <>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary', mb: 1, px: 0.5 }}>
              推荐 · {recommendedItems.length} 个
            </Typography>
            <List className="vf-scroll" sx={{ maxHeight: isDesktop ? '52vh' : '48dvh', overflow: 'auto', px: 0.5 }}>
              {recommendedItems.length === 0 ? (
                <ListItem>
                  <ListItemText primary="该组暂无推荐动作" />
                </ListItem>
              ) : (
                recommendedItems.map(({ exercise, config }) => {
                  const isAdded = addedIds.has(exercise.id);
                  return (
                    <ExerciseOption
                      key={exercise.id}
                      exercise={exercise}
                      disabled={isAdded}
                      badge={isAdded ? '已添加' : undefined}
                      secondaryInfo={
                        config.targetSets || config.targetReps
                          ? `${config.targetSets ?? 3} 组 × ${config.targetReps ?? 12} 次`
                          : undefined
                      }
                      onSelect={() => handleSelectRecommended(exercise, config)}
                    />
                  );
                })
              )}
            </List>

            <Divider sx={{ my: 1.5 }} />

            {/* "搜索更多动作"紧邻推荐列表 */}
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
          /* 全局搜索 */
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

            <List className="vf-scroll" sx={{ maxHeight: isDesktop ? '52vh' : '48dvh', overflow: 'auto', px: 0.5 }}>
              {filteredAllExercises.length === 0 ? (
                <ListItem>
                  <ListItemText primary="没有找到匹配的动作" />
                </ListItem>
              ) : (
                filteredAllExercises.map((exercise) => {
                  const isAdded = addedIds.has(exercise.id);
                  return (
                    <ExerciseOption
                      key={exercise.id}
                      exercise={exercise}
                      disabled={isAdded}
                      badge={isAdded ? '已添加' : undefined}
                      onSelect={() => handleSelectFromLibrary(exercise)}
                    />
                  );
                })
              )}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={handleClose}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}

interface ExerciseOptionProps {
  exercise: Exercise;
  onSelect: () => void;
  disabled?: boolean;
  badge?: string;
  secondaryInfo?: string;
}

function ExerciseOption({ exercise, onSelect, disabled, badge, secondaryInfo }: ExerciseOptionProps) {
  const secondaryText = secondaryInfo ?? exercise.muscleGroups?.join(', ');
  return (
    <ListItem disablePadding>
      <ListItemButton
        data-testid={`exercise-option-${exercise.id}`}
        onClick={onSelect}
        disabled={disabled}
        sx={{
          borderRadius: '12px',
          mb: 0.75,
          alignItems: 'center',
          gap: 1.25,
          py: 1,
          minHeight: 56,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <ExerciseImage exerciseId={exercise.id} exerciseName={exercise.name} type={exercise.type} size={52} />
        </Box>
        <ListItemText
          primary={exercise.name}
          secondary={secondaryText}
          primaryTypographyProps={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}
          secondaryTypographyProps={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem' }}
        />
        {badge && (
          <Chip
            size="small"
            label={badge}
            icon={<CheckIcon sx={{ fontSize: '0.9rem !important' }} />}
            sx={{ height: 22, bgcolor: 'rgba(5, 169, 120, 0.1)', color: '#078c66', fontWeight: 700, fontSize: '0.7rem' }}
          />
        )}
      </ListItemButton>
    </ListItem>
  );
}
