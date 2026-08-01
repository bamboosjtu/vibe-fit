import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
  FitnessCenter as StrengthIcon,
  DirectionsRun as CardioIcon,
} from '@mui/icons-material';
import { useSessionStore, useSettingsStore } from '../../stores';
import { formatTime, calculateSessionDuration, formatDuration } from '../../utils/helpers';
import type { TrainingSession } from '../../types';

interface GroupedSessions {
  [key: string]: TrainingSession[];
}

export function HistoryPage() {
  const { sessions, initialize, deleteSession, updateSessionNotes } = useSessionStore();
  const { weightUnit } = useSettingsStore();

  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // 初始加载
  useEffect(() => {
    initialize().then(() => setInitialized(true));
  }, [initialize]);

  // 页面获得焦点时重新加载（从其他页面返回时）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        initialize();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [initialize]);

  // 使用定时器轮询，每 2 秒检查一次新数据
  useEffect(() => {
    const interval = setInterval(() => {
      initialize();
    }, 2000);

    return () => clearInterval(interval);
  }, [initialize]);

  // 按日期分组训练记录
  const groupedSessions = useMemo(() => {
    const filtered = sessions.filter(session => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        session.dayName?.toLowerCase().includes(query) ||
        session.exercises.some(e => e.exerciseName.toLowerCase().includes(query))
      );
    });

    const grouped: GroupedSessions = {};
    filtered.forEach(session => {
      const date = new Date(session.startedAt);
      const dateKey = date.toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });

    return grouped;
  }, [sessions, searchQuery]);

  // 获取分组标题
  const getGroupTitle = (dateKey: string): string => {
    const date = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今天';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    return `${date.getFullYear()}年${monthNames[date.getMonth()]}`;
  };

  // 格式化日期显示
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return {
      weekDay: weekDays[date.getDay()],
      day: date.getDate(),
    };
  };

  if (!initialized) {
    return (
      <Box 
        sx={{ 
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          bgcolor: 'background.default',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            animation: 'pulse 2s infinite',
          }}
        >
          <StrengthIcon sx={{ color: 'white', fontSize: 24 }} />
        </Box>
        <Typography 
          sx={{ 
            color: 'text.secondary',
            fontFamily: '"Nunito", sans-serif',
            fontWeight: 600,
          }}
        >
          加载中...
        </Typography>
      </Box>
    );
  }

  const handleViewDetail = (session: TrainingSession) => {
    setSelectedSession(session);
    setEditingNotes(session.notes || '');
    setShowDetailDialog(true);
    setIsEditingNotes(false);
  };

  const handleDelete = async () => {
    if (selectedSession) {
      await deleteSession(selectedSession.id);
      setSelectedSession(null);
      setShowDeleteDialog(false);
      setShowDetailDialog(false);
    }
  };

  const handleSaveNotes = async () => {
    if (selectedSession) {
      await updateSessionNotes(selectedSession.id, editingNotes);
      // 同步更新本地 selectedSession 状态，使模态框立即显示新笔记
      setSelectedSession({
        ...selectedSession,
        notes: editingNotes,
      });
      setIsEditingNotes(false);
    }
  };

  const getTotalSets = (session: TrainingSession): number => {
    return session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  };

  const getExerciseCount = (session: TrainingSession): number => {
    return session.exercises.length;
  };

  // 判断是否为有氧训练
  const isCardioSession = (session: TrainingSession): boolean => {
    return session.exercises.every(e => e.type === 'cardio');
  };

  // 获取有氧训练数据
  const getCardioStats = (session: TrainingSession) => {
    let totalDuration = 0;
    let totalDistance = 0;

    session.exercises.forEach(exercise => {
      exercise.sets.forEach(set => {
        if (set.duration) totalDuration += set.duration;
        if (set.distance) totalDistance += set.distance;
      });
    });

    return { duration: totalDuration, distance: totalDistance };
  };

  // 渲染训练记录项
  const renderSessionItem = (session: TrainingSession) => {
    const isCardio = isCardioSession(session);
    const cardioStats = isCardio ? getCardioStats(session) : null;

    return (
      <Box
        key={session.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&:last-child': { borderBottom: 'none' },
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(16, 185, 129, 0.05)',
          },
        }}
        onClick={() => handleViewDetail(session)}
      >
        {/* 训练内容 */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: isCardio 
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)'
                  : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCardio ? (
                <CardioIcon sx={{ color: 'warning.main', fontSize: 18 }} />
              ) : (
                <StrengthIcon sx={{ color: 'primary.main', fontSize: 18 }} />
              )}
            </Box>
            <Typography 
              variant="body1" 
              fontWeight="medium"
              sx={{ fontFamily: '"Poppins", sans-serif' }}
            >
              {session.dayName || '自由训练'}
            </Typography>
          </Box>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            {isCardio && cardioStats ? (
              `${cardioStats.duration}分钟 · ${cardioStats.distance}公里`
            ) : (
              `${getExerciseCount(session)}个动作 · ${getTotalSets(session)}组`
            )}
          </Typography>
        </Box>

        {/* 右侧箭头 */}
        <ChevronRightIcon sx={{ color: 'text.disabled' }} />
      </Box>
    );
  };

  // 模拟数据（如果没有真实数据）
  const hasData = Object.keys(groupedSessions).length > 0;

  return (
    <Box 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        bgcolor: 'background.default',
      }}
    >
      {/* 固定头部区域 */}
      <Box 
        sx={{ 
          p: 2, 
          pb: 1.5, 
          bgcolor: 'background.default', 
          flexShrink: 0,
        }}
      >
        {/* 页面标题 */}
        <Box sx={{ mb: 2.5 }}>
          <Typography 
            variant="h5" 
            fontWeight="bold"
            sx={{
              fontFamily: '"Poppins", sans-serif',
              background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            训练历史记录
          </Typography>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            回顾你的训练历程
          </Typography>
        </Box>

        {/* 搜索框 */}
        <TextField
          fullWidth
          placeholder="搜索动作、计划或日期..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              bgcolor: 'background.paper',
              '& fieldset': {
                borderColor: 'divider',
                borderWidth: '2px',
              },
              '&:hover fieldset': {
                borderColor: 'primary.light',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'primary.main',
                borderWidth: '2px',
              },
            },
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'text.disabled', mr: 1 }} />,
          }}
        />
      </Box>

      {/* 可滚动内容区域 */}
      <Box
        className="vf-scroll"
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          px: 2, 
          pb: 2,
        }}
      >
        {/* 训练记录列表 */}
      {hasData ? (
        Object.entries(groupedSessions).map(([dateKey, daySessions]) => {
          const { weekDay, day } = formatDateDisplay(dateKey);
          const groupTitle = getGroupTitle(dateKey);

          return (
            <Box key={dateKey} sx={{ mb: 3 }}>
              {/* 分组标题 */}
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 1.5, 
                  fontWeight: 'medium',
                  fontFamily: '"Nunito", sans-serif',
                }}
              >
                {groupTitle}
              </Typography>

              {/* 日期卡片 */}
              <Card 
                sx={{ 
                  borderRadius: '12px',
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* 左侧日期块 */}
                    <Box
                      sx={{
                        width: 50,
                        minWidth: 50,
                        textAlign: 'center',
                        pt: 0.5,
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        display="block"
                        sx={{ fontFamily: '"Nunito", sans-serif' }}
                      >
                        {weekDay}
                      </Typography>
                      <Typography 
                        variant="h5" 
                        fontWeight="bold" 
                        color="text.primary"
                        sx={{ fontFamily: '"Poppins", sans-serif' }}
                      >
                        {day}
                      </Typography>
                    </Box>

                    {/* 训练记录列表 */}
                    <Box sx={{ flex: 1 }}>
                      {daySessions.map(session => renderSessionItem(session))}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          );
        })
      ) : (
        // 空状态
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.10) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '2rem',
            }}
          >
            📊
          </Box>
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ 
              mb: 1,
              fontFamily: '"Poppins", sans-serif',
              fontWeight: 600,
            }}
          >
            暂无训练记录
          </Typography>
          <Typography 
            variant="caption" 
            color="text.disabled"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            开始您的第一次训练吧！
          </Typography>
        </Box>
      )}

      {/* 底部统计 */}
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Typography variant="caption" color="text.disabled">
          {sessions.length > 0 ? `已加载全部 · 累计 ${sessions.length} 次训练` : '暂无训练记录'}
        </Typography>
      </Box>

      {/* 详情对话框 */}
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedSession && (
          <>
            <DialogTitle>
              {selectedSession.dayName || '自由训练'}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {new Date(selectedSession.startedAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })} {formatTime(selectedSession.startedAt)}
              </Typography>

              {selectedSession.endedAt && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  时长: {formatDuration(calculateSessionDuration(selectedSession.startedAt, selectedSession.endedAt))}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              {/* 动作详情 */}
              {selectedSession.exercises.map((exercise) => (
                <Box key={exercise.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {exercise.exerciseName}
                  </Typography>
                  {exercise.sets.length > 0 ? (
                    <Box sx={{ pl: 2 }}>
                      {exercise.sets.map((set) => (
                        <Typography key={set.id} variant="body2" color="text.secondary">
                          第{set.setNumber}组: {set.weight && `${set.weight}${weightUnit} `}
                          {set.reps && `× ${set.reps}次`}
                          {set.duration && `${set.duration}分钟`}
                          {set.distance && ` ${set.distance}km`}
                          {set.rpe && ` (RPE ${set.rpe})`}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      无记录
                    </Typography>
                  )}
                </Box>
              ))}

              <Divider sx={{ my: 2 }} />

              {/* 笔记 */}
              <Typography variant="subtitle2" gutterBottom>
                训练笔记:
              </Typography>
              {isEditingNotes ? (
                <TextField
                  multiline
                  fullWidth
                  rows={3}
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  sx={{ mb: 1 }}
                />
              ) : (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {selectedSession.notes || '无笔记'}
                </Typography>
              )}

              {isEditingNotes ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => setIsEditingNotes(false)}>
                    取消
                  </Button>
                  <Button size="small" variant="contained" onClick={handleSaveNotes}>
                    保存
                  </Button>
                </Box>
              ) : (
                <Button size="small" onClick={() => setIsEditingNotes(true)}>
                  编辑笔记
                </Button>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                color="error"
                onClick={() => setShowDeleteDialog(true)}
              >
                删除记录
              </Button>
              <Button onClick={() => setShowDetailDialog(false)}>
                关闭
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>删除训练记录</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除这条训练记录吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>取消</Button>
          <Button onClick={handleDelete} color="error">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Box>
  );
}
