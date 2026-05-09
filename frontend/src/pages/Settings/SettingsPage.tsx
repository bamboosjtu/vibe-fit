import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  ChevronRight as ChevronRightIcon,
  Security as SecurityIcon,
  CloudSync as CloudSyncIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSettingsStore, usePlanStore, useSessionStore } from '../../stores';
import { exportAllData, importAllData, clearAllData } from '../../db';
import { downloadJSON, readJSONFile, validateExportData } from '../../utils/helpers';
import { checkBackendConnection, post } from '../../services/apiClient';
import type { ExportData } from '../../types';

const APP_VERSION = '1.0.4';
const BUILD_NUMBER = '82';

export function SettingsPage() {
  const { initialize: initSettings } = useSettingsStore();
  const { initialize: initPlans } = usePlanStore();
  const { initialize: initSessions } = useSessionStore();

  const [initialized, setInitialized] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportConfirmDialog, setShowImportConfirmDialog] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  // 云同步状态
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [backendVersion, setBackendVersion] = useState<string>('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [showPullConfirmDialog, setShowPullConfirmDialog] = useState(false);

  useEffect(() => {
    initSettings().then(() => setInitialized(true));
  }, [initSettings]);

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
          <SecurityIcon sx={{ color: 'white', fontSize: 24 }} />
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

  const handleExport = async () => {
    const data = await exportAllData();
    const exportData: ExportData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      settings: data.settings || {
        weightUnit: 'kg',
        distanceUnit: 'km',
        darkMode: false,
        schemaVersion: 1,
      },
      plans: data.plans,
      sessions: data.sessions,
      exercises: data.exercises,
    };

    const filename = `vibefit-backup-${new Date().toISOString().split('T')[0]}.json`;
    downloadJSON(exportData, filename);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportSuccess(false);

    try {
      const data = await readJSONFile(file);

      if (!validateExportData(data)) {
        setImportError('无效的数据文件格式');
        return;
      }

      setImportData(data as ExportData);
      setShowImportConfirmDialog(true);
    } catch {
      setImportError('读取文件失败');
    }

    // 重置 input
    event.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importData) return;

    try {
      await importAllData({
        settings: importData.settings,
        plans: importData.plans,
        sessions: importData.sessions,
        exercises: importData.exercises,
      });

      // 重新加载所有数据
      await Promise.all([initSettings(), initPlans(), initSessions()]);

      setImportSuccess(true);
      setShowImportConfirmDialog(false);
      setShowImportDialog(false);
      setImportData(null);
    } catch {
      setImportError('导入数据失败');
    }
  };

  const handleClearData = async () => {
    try {
      await clearAllData();
      // 重新初始化默认设置
      await Promise.all([initSettings(), initPlans(), initSessions()]);
      setClearSuccess(true);
      setShowClearDialog(false);
    } catch {
      // 清除失败
    }
  };

  // 检查后端连接
  const handleCheckConnection = async () => {
    setSyncError('');
    setSyncSuccess('');
    const result = await checkBackendConnection();
    setBackendConnected(result.connected);
    if (result.connected) {
      setBackendVersion(result.version || '');
    }
  };

  // 上传本地数据到云端
  const handlePushToCloud = async () => {
    setSyncLoading(true);
    setSyncError('');
    setSyncSuccess('');
    try {
      const data = await exportAllData();
      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        settings: data.settings,
        plans: data.plans,
        sessions: data.sessions,
        exercises: data.exercises,
      };
      const response = await post<{ success: boolean; syncedAt: string; message: string }>('/api/sync/push', payload);
      setLastSyncedAt(response.syncedAt);
      setSyncSuccess('数据已成功上传到云端');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setSyncLoading(false);
    }
  };

  // 从云端恢复数据
  const handlePullFromCloud = async () => {
    setSyncLoading(true);
    setSyncError('');
    setSyncSuccess('');
    try {
      const response = await post<{ success: boolean; data: ExportData | null; syncedAt: string }>('/api/sync/pull', {});
      if (response.data) {
        await importAllData({
          settings: response.data.settings,
          plans: response.data.plans,
          sessions: response.data.sessions,
          exercises: response.data.exercises,
        });
        await Promise.all([initSettings(), initPlans(), initSessions()]);
        setLastSyncedAt(response.syncedAt);
        setSyncSuccess('数据已从云端恢复');
      } else {
        setSyncError('云端没有数据');
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '恢复失败');
    } finally {
      setSyncLoading(false);
      setShowPullConfirmDialog(false);
    }
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
        {/* 页面大标题 */}
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
            设置
          </Typography>
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            个性化你的健身体验
          </Typography>
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
        {/* 云同步 */}
        <Box sx={{ mb: 3 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1.5,
              fontWeight: 'medium',
              fontFamily: '"Nunito", sans-serif',
            }}
          >
            云同步
          </Typography>

          <Card
            sx={{
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              {/* 连接状态 */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CloudSyncIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="body1" sx={{ fontFamily: '"Poppins", sans-serif' }}>
                    云端备份
                  </Typography>
                </Box>
                {backendConnected === true && (
                  <Chip
                    size="small"
                    icon={<CheckCircleIcon />}
                    label={`已连接 ${backendVersion ? `v${backendVersion}` : ''}`}
                    sx={{
                      bgcolor: 'rgba(16, 185, 129, 0.1)',
                      color: 'success.main',
                      fontWeight: 600,
                      fontFamily: '"Nunito", sans-serif',
                    }}
                  />
                )}
                {backendConnected === false && (
                  <Chip
                    size="small"
                    icon={<ErrorIcon />}
                    label="未连接"
                    sx={{
                      bgcolor: 'rgba(239, 68, 68, 0.1)',
                      color: 'error.main',
                      fontWeight: 600,
                      fontFamily: '"Nunito", sans-serif',
                    }}
                  />
                )}
              </Box>

              {/* 上次同步时间 */}
              {lastSyncedAt && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    mb: 2,
                    fontFamily: '"Nunito", sans-serif',
                  }}
                >
                  上次同步: {new Date(lastSyncedAt).toLocaleString('zh-CN')}
                </Typography>
              )}

              {syncError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {syncError}
                </Alert>
              )}

              {syncSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {syncSuccess}
                </Alert>
              )}

              {/* 操作按钮 */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleCheckConnection}
                disabled={syncLoading}
                sx={{
                  mb: 1.5,
                  borderRadius: '12px',
                  py: 1.5,
                  borderWidth: 2,
                  borderColor: 'primary.light',
                  color: 'primary.main',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontFamily: '"Poppins", sans-serif',
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(16, 185, 129, 0.05)',
                  },
                }}
              >
                检查后端连接
              </Button>

              <Button
                fullWidth
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={handlePushToCloud}
                disabled={syncLoading || backendConnected === false}
                sx={{
                  mb: 1.5,
                  borderRadius: '12px',
                  py: 1.5,
                  background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontFamily: '"Poppins", sans-serif',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)',
                  },
                  '&.Mui-disabled': {
                    background: 'rgba(16, 185, 129, 0.3)',
                    color: 'rgba(255, 255, 255, 0.6)',
                  },
                }}
              >
                上传本地数据到云端
              </Button>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<CloudDownloadIcon />}
                onClick={() => setShowPullConfirmDialog(true)}
                disabled={syncLoading || backendConnected === false}
                sx={{
                  borderRadius: '12px',
                  py: 1.5,
                  borderWidth: 2,
                  borderColor: 'warning.light',
                  color: 'warning.main',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontFamily: '"Poppins", sans-serif',
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: 'warning.main',
                    bgcolor: 'rgba(245, 158, 11, 0.05)',
                  },
                }}
              >
                从云端恢复数据
              </Button>
            </CardContent>
          </Card>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* 数据管理 */}
        <Box sx={{ mb: 3 }}>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 1.5, 
            fontWeight: 'medium',
            fontFamily: '"Nunito", sans-serif',
          }}
        >
          数据管理
        </Typography>

        <Card 
          sx={{ 
            borderRadius: '16px', 
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {/* 导出按钮 */}
            <Button
              fullWidth
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              sx={{
                mb: 1.5,
                borderRadius: '12px',
                py: 1.5,
                background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
                fontWeight: 'bold',
                textTransform: 'none',
                fontFamily: '"Poppins", sans-serif',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)',
                },
              }}
            >
              导出数据 (JSON)
            </Button>

            {/* 导入按钮 */}
            <Button
              fullWidth
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setShowImportDialog(true)}
              sx={{
                borderRadius: '12px',
                py: 1.5,
                borderWidth: 2,
                borderColor: 'primary.light',
                color: 'primary.main',
                fontWeight: 'bold',
                textTransform: 'none',
                fontFamily: '"Poppins", sans-serif',
                '&:hover': {
                  borderWidth: 2,
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(16, 185, 129, 0.05)',
                },
              }}
            >
              导入数据 (JSON)
            </Button>

            {/* 清除数据按钮 */}
            <Button
              fullWidth
              variant="outlined"
              color="error"
              onClick={() => setShowClearDialog(true)}
              sx={{
                mt: 1.5,
                borderRadius: '12px',
                py: 1.5,
                borderWidth: 2,
                fontWeight: 'bold',
                textTransform: 'none',
                fontFamily: '"Poppins", sans-serif',
                '&:hover': {
                  borderWidth: 2,
                },
              }}
            >
              清除数据
            </Button>

            {/* 说明文字 */}
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                mt: 1.5, 
                display: 'block', 
                textAlign: 'center',
                fontFamily: '"Nunito", sans-serif',
              }}
            >
              您的训练数据存储在本地。请定期导出备份，以保护您的训练进度。
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 关于应用 */}
      <Box sx={{ mb: 3 }}>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 1.5, 
            fontWeight: 'medium',
            fontFamily: '"Nunito", sans-serif',
          }}
        >
          关于应用
        </Typography>

        <Card 
          sx={{ 
            borderRadius: '16px', 
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {/* 版本 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography 
                variant="body1"
                sx={{ fontFamily: '"Poppins", sans-serif' }}
              >
                版本
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary"
                sx={{ fontFamily: '"Nunito", sans-serif' }}
              >
                {APP_VERSION} (Build {BUILD_NUMBER})
              </Typography>
            </Box>

            {/* 隐私政策 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: 'rgba(16, 185, 129, 0.05)',
                },
              }}
            >
              <Typography 
                variant="body1"
                sx={{ fontFamily: '"Poppins", sans-serif' }}
              >
                隐私政策
              </Typography>
              <ChevronRightIcon sx={{ color: 'text.disabled' }} />
            </Box>

            {/* 开源许可 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { 
                  bgcolor: 'rgba(16, 185, 129, 0.05)',
                },
              }}
            >
              <Typography 
                variant="body1"
                sx={{ fontFamily: '"Poppins", sans-serif' }}
              >
                开源许可
              </Typography>
              <ChevronRightIcon sx={{ color: 'text.disabled' }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* 底部隐私说明 */}
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 1 }}>
          <SecurityIcon sx={{ color: 'text.disabled', fontSize: 16 }} />
          <Typography 
            variant="caption" 
            color="text.disabled" 
            fontWeight="medium"
            sx={{ fontFamily: '"Nunito", sans-serif' }}
          >
            隐私设计
          </Typography>
        </Box>
        <Typography 
          variant="caption" 
          color="text.disabled" 
          sx={{ 
            display: 'block', 
            px: 4,
            fontFamily: '"Nunito", sans-serif',
          }}
        >
          默认本地存储，主动云同步时才上传。无追踪，完全个人拥有。
        </Typography>
      </Box>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>导入数据</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            导入数据将覆盖所有现有数据，请确保已备份重要数据。
          </Alert>

          {importError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {importError}
            </Alert>
          )}

          {importSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              数据导入成功！
            </Alert>
          )}

          <Button
            variant="contained"
            component="label"
            fullWidth
          >
            选择文件
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleImportFile}
            />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 导入确认对话框 */}
      <Dialog open={showImportConfirmDialog} onClose={() => setShowImportConfirmDialog(false)}>
        <DialogTitle>确认导入</DialogTitle>
        <DialogContent>
          <Typography>
            确定要导入数据吗？这将覆盖所有现有数据。
          </Typography>
          {importData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                导出时间: {new Date(importData.exportedAt).toLocaleString('zh-CN')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                应用版本: {importData.appVersion}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                计划数量: {importData.plans?.length || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                训练记录: {importData.sessions?.length || 0}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportConfirmDialog(false)}>取消</Button>
          <Button onClick={handleConfirmImport} variant="contained" color="primary">
            确认导入
          </Button>
        </DialogActions>
      </Dialog>

      {/* 从云端恢复确认对话框 */}
      <Dialog open={showPullConfirmDialog} onClose={() => setShowPullConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>从云端恢复数据</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            恢复云端数据将覆盖所有本地现有数据，包括训练计划、训练记录和设置。此操作不可恢复！
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPullConfirmDialog(false)}>取消</Button>
          <Button onClick={handlePullFromCloud} variant="contained" color="warning" disabled={syncLoading}>
            确认恢复
          </Button>
        </DialogActions>
      </Dialog>

      {/* 清除数据确认对话框 */}
      <Dialog open={showClearDialog} onClose={() => setShowClearDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>清除数据</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            此操作将删除所有数据，包括训练计划、训练记录和设置。此操作不可恢复！
          </Alert>
          {clearSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              数据已清除！
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearDialog(false)}>取消</Button>
          <Button onClick={handleClearData} variant="contained" color="error">
            确认清除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Box>
  );
}
