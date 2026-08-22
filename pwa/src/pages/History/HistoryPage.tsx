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
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  ChevronRight as ChevronRightIcon,
  FitnessCenter as StrengthIcon,
  DirectionsRun as CardioIcon,
  Layers as MixedIcon,
} from '@mui/icons-material';
import { useSessionStore, useSettingsStore } from '../../stores';
import { formatTime, calculateSessionDuration, formatHistoryDuration } from '../../utils/helpers';
import { formatTimer } from '../../domain/sessionTimer';
import { formatPace } from '../../domain/cardioMetrics';
import { getCardioStats } from '../../domain/historyStats';
import { LoadingState } from '../../components/LoadingState';
import type { TrainingSession, SessionExercise } from '../../types';

type SessionType = 'strength' | 'cardio' | 'mixed';

interface GroupedSessions {
  [key: string]: TrainingSession[];
}

export function HistoryPage() {
  const { sessions, loadSessions, deleteSession, updateSessionNotes } = useSessionStore();
  const { weightUnit } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // 进入页面调用 loadSessions() 一次
  // endSession 完成后 store 已主动调用 loadSessions，无需轮询或重复 initialize
  useEffect(() => {
    loadSessions().finally(() => setLoading(false));
  }, [loadSessions]);

  // 已结束的训练记录（仅显示有 endedAt 的会话，排除 activeSession）
  const endedSessions = useMemo(
    () => sessions.filter(session => session.endedAt),
    [sessions],
  );

  // 按日期分组训练记录
  const groupedSessions = useMemo(() => {
    const filtered = endedSessions.filter(session => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      // 搜索训练日名称、动作名、计划名快照、日期
      const dateStr = new Date(session.startedAt).toLocaleDateString('zh-CN');
      const planName = session.planName ?? '';
      return (
        session.dayName?.toLowerCase().includes(query) ||
        dateStr.toLowerCase().includes(query) ||
        planName.toLowerCase().includes(query) ||
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
  }, [endedSessions, searchQuery]);

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

  if (loading) {
    return <LoadingState />;
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

  // 判断训练类型：strength / cardio / mixed
  // 同时包含 strength 和 cardio 为 mixed；仅 cardio 为 cardio；仅 strength 为 strength
  const getSessionType = (session: TrainingSession): SessionType => {
    const hasStrength = session.exercises.some(e => e.type === 'strength');
    const hasCardio = session.exercises.some(e => e.type === 'cardio');
    if (hasStrength && hasCardio) return 'mixed';
    if (hasCardio) return 'cardio';
    return 'strength';
  };

  // 训练类型标签文字
  const getSessionTypeLabel = (sessionType: SessionType): string => {
    switch (sessionType) {
      case 'cardio':
        return '有氧';
      case 'mixed':
        return '混合';
      default:
        return '力量';
    }
  };

  // 获取力量训练统计
  // 区分完成组与计划组：历史摘要只显示完成组
  const getStrengthStats = (session: TrainingSession) => {
    let exerciseCount = 0;
    let totalCompletedSets = 0;
    let totalPlannedSets = 0;
    session.exercises.forEach(exercise => {
      if (exercise.type === 'strength') {
        exerciseCount++;
        totalPlannedSets += exercise.sets.length;
        totalCompletedSets += exercise.sets.filter(set => Boolean(set.completedAt)).length;
      }
    });
    return { exerciseCount, totalCompletedSets, totalPlannedSets };
  };

  // 渲染训练记录项
  const renderSessionItem = (session: TrainingSession) => {
    const sessionType = getSessionType(session);
    const cardioStats = getCardioStats(session);
    const strengthStats = getStrengthStats(session);
    // 总时长优先使用结算的 elapsedSeconds（排除暂停时间）；无则回退到墙上时间
    const durationSeconds = session.elapsedSeconds
      ?? calculateSessionDuration(session.startedAt, session.endedAt) * 60;

    // 构建副标题摘要：力量摘要 + 有氧摘要 + 总训练时长
    const buildSummary = (): string => {
      const parts: string[] = [];
      if (sessionType === 'cardio') {
        parts.push(`${cardioStats.count}个动作`);
        if (cardioStats.durationSeconds > 0) {
          parts.push(formatTimer(cardioStats.durationSeconds));
        }
        if (cardioStats.distanceMeters > 0) {
          parts.push(`${(cardioStats.distanceMeters / 1000).toFixed(2)}公里`);
        }
      } else if (sessionType === 'mixed') {
        // 力量摘要显示 完成/计划 组数
        parts.push(`力量 ${strengthStats.exerciseCount}个动作 · 完成 ${strengthStats.totalCompletedSets}/${strengthStats.totalPlannedSets}组`);
        if (cardioStats.count > 0) {
          const cardioParts: string[] = [`${cardioStats.count}个动作`];
          if (cardioStats.durationSeconds > 0) {
            cardioParts.push(formatTimer(cardioStats.durationSeconds));
          }
          parts.push(`有氧 ${cardioParts.join(' ')}`);
        }
      } else {
        // strength
        parts.push(`${strengthStats.exerciseCount}个动作`);
        // 显示 完成/计划 组数
        parts.push(`完成 ${strengthStats.totalCompletedSets}/${strengthStats.totalPlannedSets}组`);
      }
      parts.push(`总时长 ${formatHistoryDuration(durationSeconds)}`);
      return parts.join(' · ');
    };

    // 图标和背景色
    const getIconConfig = () => {
      switch (sessionType) {
        case 'cardio':
          return {
            icon: <CardioIcon sx={{ color: 'warning.main', fontSize: 18 }} />,
            bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
            color: 'warning.main' as const,
          };
        case 'mixed':
          return {
            icon: <MixedIcon sx={{ color: 'secondary.main', fontSize: 18 }} />,
            bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%)',
            color: 'secondary.main' as const,
          };
        default:
          return {
            icon: <StrengthIcon sx={{ color: 'primary.main', fontSize: 18 }} />,
            bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
            color: 'primary.main' as const,
          };
      }
    };

    const iconConfig = getIconConfig();
    const typeLabel = getSessionTypeLabel(sessionType);

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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: iconConfig.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {iconConfig.icon}
            </Box>
            <Typography
              variant="body1"
              fontWeight="medium"
              sx={{ fontFamily: '"Poppins", sans-serif' }}
            >
              {session.dayName || '自由训练'}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: '"Nunito", sans-serif' }}
            >
              {formatTime(session.startedAt)}
            </Typography>
            <Chip
              label={typeLabel}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: iconConfig.color,
                background: iconConfig.bg,
                border: 'none',
                '.MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            {buildSummary()}
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
          placeholder="搜索训练日、动作、计划或日期…"
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
          {endedSessions.length > 0 ? `已加载全部 · 累计 ${endedSessions.length} 次训练` : '暂无训练记录'}
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
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {selectedSession.dayName || '自由训练'}
              <Chip
                label={getSessionTypeLabel(getSessionType(selectedSession))}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                }}
              />
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
                  时长: {formatHistoryDuration(
                    selectedSession.elapsedSeconds
                      ?? calculateSessionDuration(selectedSession.startedAt, selectedSession.endedAt) * 60,
                  )}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              {/* 动作详情 */}
              {selectedSession.exercises.map((exercise) => (
                <ExerciseDetail key={exercise.id} exercise={exercise} weightUnit={weightUnit} />
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

// 动作详情组件：区分力量和有氧，正确展示 cardioRecord 数据
function ExerciseDetail({
  exercise,
  weightUnit,
}: {
  exercise: SessionExercise;
  weightUnit: 'kg' | 'lb';
}) {
  const isCardio = exercise.type === 'cardio';
  const record = exercise.cardioRecord;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold">
        {exercise.exerciseName}
      </Typography>

      {isCardio ? (
        // 有氧动作：展示 cardioRecord 摘要
        <Box sx={{ pl: 2 }}>
          {record && record.status === 'completed' ? (
            <>
              <Typography variant="body2" color="text.secondary">
                实际时长: {formatTimer(record.elapsedSeconds ?? 0)}
              </Typography>
              {record.speed != null && (
                <Typography variant="body2" color="text.secondary">
                  速度: {record.speed} km/h
                </Typography>
              )}
              {record.incline != null && (
                <Typography variant="body2" color="text.secondary">
                  坡度: {record.incline}%
                </Typography>
              )}
              {record.distanceMeters != null && (
                <Typography variant="body2" color="text.secondary">
                  距离: {(record.distanceMeters / 1000).toFixed(2)} km ({Math.round(record.distanceMeters)} m)
                </Typography>
              )}
              {record.calories != null && (
                <Typography variant="body2" color="text.secondary">
                  消耗: {record.calories} kcal
                </Typography>
              )}
              {record.paceSecondsPer500m != null && (
                <Typography variant="body2" color="text.secondary">
                  平均配速: {formatPace(record.paceSecondsPer500m)} /500m
                </Typography>
              )}
              {record.resistance != null && (
                <Typography variant="body2" color="text.secondary">
                  阻力等级: {record.resistance}
                </Typography>
              )}
              {record.rpe != null && (
                <Typography variant="body2" color="text.secondary">
                  RPE: {record.rpe}
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              未完成
            </Typography>
          )}
        </Box>
      ) : (
        // 力量动作：展示组记录
        <Box sx={{ pl: 2 }}>
          {exercise.sets.length > 0 ? (
            exercise.sets.map((set) => (
              <Typography key={set.id} variant="body2" color="text.secondary">
                第{set.setNumber}组: {set.weight != null && `${set.weight}${weightUnit} `}
                {set.reps != null && `× ${set.reps}次`}
                {set.duration != null && `${set.duration}分钟`}
                {set.distance != null && ` ${set.distance}km`}
                {set.rpe != null && ` (RPE ${set.rpe})`}
              </Typography>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              无记录
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
