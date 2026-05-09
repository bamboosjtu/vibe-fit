import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudSync as CloudSyncIcon,
  BarChart as BarChartIcon,
  Bolt as BoltIcon,
  ChevronRight as ChevronRightIcon,
  PlayArrow as PlayIcon,
  FitnessCenter as FitnessCenterIcon,
  DirectionsRun as DirectionsRunIcon,
} from '@mui/icons-material';
import { usePlanStore, useSessionStore } from '../../stores';
import { TRAINING_TEMPLATES } from '../../constants/templates';
import type { TrainingPlan, TrainingDay } from '../../types';

export function PlansPage() {
  const navigate = useNavigate();
  const {
    currentPlan,
    initialize,
    createFromTemplate,
    createEmpty,
    deletePlan,
    renamePlan,
  } = usePlanStore();
  
  const { startSession, initialize: initializeSession } = useSessionStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    Promise.all([initialize(), initializeSession()]).then(() => setInitialized(true));
  }, [initialize, initializeSession]);

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
          <FitnessCenterIcon sx={{ color: 'white', fontSize: 24 }} />
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

  const handleTemplateClick = (templateIndex: number) => {
    setSelectedTemplateIndex(templateIndex);
    setShowApplyDialog(true);
  };

  const handleApplyTemplate = async () => {
    if (selectedTemplateIndex !== null) {
      const template = TRAINING_TEMPLATES[selectedTemplateIndex];
      await createFromTemplate(template, template.name);
      setShowApplyDialog(false);
      setSelectedTemplateIndex(null);
    }
  };

  const handleCreateEmpty = async () => {
    if (newPlanName.trim()) {
      await createEmpty(newPlanName.trim());
      setNewPlanName('');
      setShowCreateDialog(false);
    }
  };

  const handleRename = async () => {
    if (selectedPlan && newPlanName.trim()) {
      await renamePlan(selectedPlan.id, newPlanName.trim());
      setNewPlanName('');
      setSelectedPlan(null);
      setShowRenameDialog(false);
    }
  };

  const handleDelete = async () => {
    if (selectedPlan) {
      await deletePlan(selectedPlan.id);
      setSelectedPlan(null);
      setShowDeleteDialog(false);
    }
  };

  // 获取训练日完成状态
  const getDayStatus = (index: number) => {
    if (!currentPlan) return 'pending';
    const currentIdx = currentPlan.currentDayIndex ?? 0;
    
    if (index === currentIdx) return 'today';
    return 'pending';
  };

  // 处理开始训练
  const handleStartTraining = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('->开始训练日');
    if (!currentPlan) return;
    const currentIdx = currentPlan.currentDayIndex ?? 0;
    const todayDay = currentPlan.days[currentIdx];
    
    if (todayDay) {
      startSession(currentPlan, todayDay);
      navigate('/today');
    }
  };

  // 渲染训练日项
  const renderDayItem = (day: TrainingDay, index: number) => {
    const status = getDayStatus(index);
    const dayNumber = index + 1;

    return (
      <Box
        key={day.id}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          borderRadius: '12px',
          bgcolor: status === 'today' 
            ? 'rgba(16, 185, 129, 0.08)' 
            : 'transparent',
          mb: 0.5,
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: status === 'today' 
              ? 'rgba(16, 185, 129, 0.12)' 
              : 'rgba(16, 185, 129, 0.05)',
          },
        }}
      >
        {/* 日期编号 */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: status === 'today' 
              ? 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)'
              : 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 1.5,
            boxShadow: status === 'today' 
              ? '0 2px 8px rgba(16, 185, 129, 0.3)'
              : 'none',
          }}
        >
          <Typography
            variant="caption"
            fontWeight="bold"
            color={status === 'today' ? 'white' : 'text.secondary'}
            sx={{ fontFamily: '"Poppins", sans-serif' }}
          >
            D{dayNumber}
          </Typography>
        </Box>

        {/* 训练日信息 */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography 
              variant="body2" 
              fontWeight="medium"
              sx={{ fontFamily: '"Poppins", sans-serif' }}
            >
              {day.name}
            </Typography>
            {status === 'today' && (
              <Chip
                size="small"
                label="今日"
                sx={{
                  height: 18,
                  fontSize: 10,
                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                  color: 'primary.dark',
                  fontWeight: 'bold',
                  fontFamily: '"Nunito", sans-serif',
                }}
              />
            )}
          </Box>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            {(day.phases || []).map(p => p.name).slice(0, 3).join('·')}
          </Typography>
        </Box>

        {/* 右侧图标 */}
        {status === 'today' ? (
          <IconButton 
            size="small" 
            sx={{ 
              color: 'primary.main',
              '&:hover': {
                bgcolor: 'rgba(16, 185, 129, 0.1)',
              },
            }} 
            onClick={handleStartTraining}
          >
            <PlayIcon fontSize="small" />
          </IconButton>
        ) : (
          <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        )}
      </Box>
    );
  };

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
        {/* 顶部标题栏 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box>
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
              训练计划
            </Typography>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ fontFamily: '"Nunito", sans-serif' }}
            >
              规划你的健身之路
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              size="small" 
              sx={{ 
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'rgba(16, 185, 129, 0.1)',
                },
              }}
            >
              <CloudSyncIcon />
            </IconButton>
            <IconButton
              size="small"
              sx={{
                background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
                color: 'white',
                '&:hover': { 
                  background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)',
                },
              }}
              onClick={() => setShowCreateDialog(true)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* 可滚动内容区域 */}
      <Box 
        sx={{ 
          flex: 1, 
          overflow: 'auto', 
          px: 2, 
          pb: 2,
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(16, 185, 129, 0.2)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(16, 185, 129, 0.3)',
          },
        }}
      >
        {/* 训练洞察 */}
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="subtitle1" 
          fontWeight="bold" 
          sx={{ 
            mb: 1.5,
            fontFamily: '"Poppins", sans-serif',
          }}
        >
          训练洞察
        </Typography>
        <Card 
          sx={{ 
            borderRadius: '16px', 
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ p: 2 }}>
            {/* 统计数据 */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BarChartIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    display="block"
                    sx={{ fontFamily: '"Nunito", sans-serif' }}
                  >
                    本周已练
                  </Typography>
                  <Typography 
                    variant="body1" 
                    fontWeight="bold" 
                    color="text.secondary"
                    sx={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    待开发
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    bgcolor: 'rgba(6, 182, 212, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BoltIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    display="block"
                    sx={{ fontFamily: '"Nunito", sans-serif' }}
                  >
                    上周总负重
                  </Typography>
                  <Typography 
                    variant="body1" 
                    fontWeight="bold" 
                    color="text.secondary"
                    sx={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    待开发
                  </Typography>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* 当前使用中 */}
      {currentPlan && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold"
              sx={{ fontFamily: '"Poppins", sans-serif' }}
            >
              当前使用中
            </Typography>
            <Typography
              variant="caption"
              sx={{ 
                color: 'primary.main',
                cursor: 'pointer',
                fontFamily: '"Nunito", sans-serif',
                fontWeight: 600,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              查看详情
            </Typography>
          </Box>

          <Card 
            sx={{ 
              borderRadius: '16px', 
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 2 }}>
              {/* 计划标题 */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box>
                  <Typography 
                    variant="h6" 
                    fontWeight="bold"
                    sx={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    {currentPlan.name}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ fontFamily: '"Nunito", sans-serif' }}
                  >
                    {currentPlan.description}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label="进行中"
                  sx={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                    color: 'primary.dark',
                    fontWeight: 600,
                    height: 22,
                    fontFamily: '"Nunito", sans-serif',
                    border: '1px solid',
                    borderColor: 'primary.light',
                  }}
                />
              </Box>

              {/* 训练日列表 */}
              <Box sx={{ mt: 2 }}>
                {currentPlan.days.map((day, index) =>
                  renderDayItem(day, index)
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* 计划模板库 */}
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="subtitle1" 
          fontWeight="bold" 
          sx={{ 
            mb: 1.5,
            fontFamily: '"Poppins", sans-serif',
          }}
        >
          计划模板库
        </Typography>

        {TRAINING_TEMPLATES.map((template, index) => (
          <Card
            key={index}
            sx={{
              mb: 1.5,
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': { 
                bgcolor: 'rgba(16, 185, 129, 0.05)',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.12)',
              },
            }}
            onClick={() => handleTemplateClick(index)}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {/* 图标 */}
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: index === 0 
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {index === 0 ? (
                    <FitnessCenterIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  ) : (
                    <DirectionsRunIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                  )}
                </Box>

                {/* 信息 */}
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="body1" 
                    fontWeight="medium"
                    sx={{ fontFamily: '"Poppins", sans-serif' }}
                  >
                    {template.name}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color="text.secondary"
                    sx={{ fontFamily: '"Nunito", sans-serif' }}
                  >
                    {template.description}
                  </Typography>
                </Box>

                {/* 频率 */}
                <Typography 
                  variant="caption" 
                  color="text.secondary" 
                  sx={{ 
                    mr: 1,
                    fontFamily: '"Nunito", sans-serif',
                    fontWeight: 600,
                  }}
                >
                  {template.days.length}-{Math.min(template.days.length + 2, 6)}次/周
                </Typography>

                <ChevronRightIcon sx={{ color: 'text.disabled' }} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* 应用计划确认对话框 */}
      <Dialog
        open={showApplyDialog}
        onClose={() => setShowApplyDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>应用训练计划</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            确定要应用「{selectedTemplateIndex !== null ? TRAINING_TEMPLATES[selectedTemplateIndex].name : ''}」吗？
          </Typography>
          <Typography variant="body2" color="text.secondary">
            应用后，该计划将成为您的当前训练计划，您可以在"今日训练"中查看今日的训练内容。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowApplyDialog(false)}>取消</Button>
          <Button onClick={handleApplyTemplate} variant="contained">
            应用该计划
          </Button>
        </DialogActions>
      </Dialog>

      {/* 创建空计划对话框 */}
      <Dialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>创建新计划</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="计划名称"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>取消</Button>
          <Button onClick={handleCreateEmpty} variant="contained" disabled={!newPlanName.trim()}>
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 重命名对话框 */}
      <Dialog
        open={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>重命名计划</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="计划名称"
            value={newPlanName}
            onChange={(e) => setNewPlanName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRenameDialog(false)}>取消</Button>
          <Button onClick={handleRename} variant="contained" disabled={!newPlanName.trim()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>删除计划</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除计划 "{selectedPlan?.name}" 吗？此操作不可撤销。
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
