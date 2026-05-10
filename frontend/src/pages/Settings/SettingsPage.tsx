import { useState, useEffect, useCallback } from 'react';
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
  Login as LoginIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore, usePlanStore, useSessionStore, useAuthStore } from '../../stores';
import { exportAllData, importAllData, clearAllData } from '../../db';
import { downloadJSON, readJSONFile, validateExportData } from '../../utils/helpers';
import { syncPush, syncPull, getSyncStatus } from '../../services/syncService';
import type { ExportData } from '../../types';

const APP_VERSION = '1.0.4';
const BUILD_NUMBER = '82';

export function SettingsPage() {
  const navigate = useNavigate();
  const { initialize: initSettings } = useSettingsStore();
  const { initialize: initPlans } = usePlanStore();
  const { initialize: initSessions } = useSessionStore();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [initialized, setInitialized] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showImportConfirmDialog, setShowImportConfirmDialog] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // 云同步状态
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState('');
  const [showPullConfirmDialog, setShowPullConfirmDialog] = useState(false);

  const fetchSyncStatus = useCallback(async () => {
    if (isAuthenticated()) {
      const status = await getSyncStatus();
      setLastSyncedAt(status.lastSyncedAt);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    initSettings().then(() => {
      setInitialized(true);
      fetchSyncStatus();
    });
  }, [initSettings, fetchSyncStatus]);

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

    try {
      const data = await readJSONFile(file);

      if (!validateExportData(data)) {
        return;
      }

      setImportData(data as ExportData);
      setShowImportConfirmDialog(true);
    } catch {
      // 读取文件失败
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

      setShowImportConfirmDialog(false);
      setShowImportDialog(false);
      setImportData(null);
    } catch {
      // 导入数据失败
    }
  };

  const handleClearData = async () => {
    try {
      await clearAllData();
      // 重新初始化默认设置
      await Promise.all([initSettings(), initPlans(), initSessions()]);
      setShowClearDialog(false);
    } catch {
      // 清除失败
    }
  };

  // 上传本地数据到云端
  const handlePushToCloud = async () => {
    setSyncLoading(true);
    setSyncError('');
    setSyncSuccess('');
    try {
      const response = await syncPush();
      setLastSyncedAt(response.syncedAt);
      setSyncSuccess('数据已成功备份到云端');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : '备份失败');
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
      const response = await syncPull();
      await Promise.all([initSettings(), initPlans(), initSessions()]);
      setLastSyncedAt(response.syncedAt);
      setSyncSuccess('数据已从云端成功恢复');
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
        </Box>
      </Box>

      {/* 可滚动内容区域 */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
          pb: 2,
        }}
      >
        {/* 账户与同步 */}
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
            账户与同步
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
              {!isAuthenticated() ? (
                <Box sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontFamily: '"Nunito", sans-serif' }}>
                    登录后即可开启云端备份，保护您的训练数据。
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<LoginIcon />}
                    onClick={() => navigate('/auth')}
                    sx={{
                      borderRadius: '12px',
                      py: 1.2,
                      background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
                      fontWeight: 'bold',
                      textTransform: 'none',
                    }}
                  >
                    前往登录
                  </Button>
                </Box>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CloudSyncIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                      <Typography variant="body1" sx={{ fontFamily: '"Poppins", sans-serif', fontWeight: 600 }}>
                        云端同步
                      </Typography>
                    </Box>
                    <Button 
                      size="small" 
                      onClick={() => logout()}
                      sx={{ color: 'text.secondary', textTransform: 'none', minWidth: 0, p: 0 }}
                    >
                      退出
                    </Button>
                  </Box>

                  <Box sx={{ mb: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">当前用户</Typography>
                      <Typography variant="caption" fontWeight="bold">{user?.email}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">最近备份</Typography>
                      <Typography variant="caption" fontWeight="bold">
                        {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : '从未备份'}
                      </Typography>
                    </Box>
                  </Box>

                  {syncError && (
                    <Alert severity="error" sx={{ mb: 2, py: 0 }}>
                      {syncError}
                    </Alert>
                  )}

                  {syncSuccess && (
                    <Alert severity="success" sx={{ mb: 2, py: 0 }}>
                      {syncSuccess}
                    </Alert>
                  )}

                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<CloudUploadIcon />}
                      onClick={handlePushToCloud}
                      disabled={syncLoading}
                      sx={{
                        borderRadius: '12px',
                        py: 1,
                        background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
                        fontWeight: 'bold',
                        textTransform: 'none',
                        fontSize: '0.875rem',
                      }}
                    >
                      立即备份
                    </Button>

                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<CloudDownloadIcon />}
                      onClick={() => setShowPullConfirmDialog(true)}
                      disabled={syncLoading}
                      sx={{
                        borderRadius: '12px',
                        py: 1,
                        borderWidth: 2,
                        borderColor: 'primary.light',
                        color: 'primary.main',
                        fontWeight: 'bold',
                        textTransform: 'none',
                        fontSize: '0.875rem',
                        '&:hover': { borderWidth: 2 },
                      }}
                    >
                      恢复备份
                    </Button>
                  </Box>
                </>
              )}
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
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                sx={{
                  mb: 1.5,
                  borderRadius: '12px',
                  py: 1.2,
                  borderColor: 'divider',
                  color: 'text.primary',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.02)', borderColor: 'text.primary' }
                }}
              >
                导出数据 (JSON)
              </Button>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => setShowImportDialog(true)}
                sx={{
                  mb: 1.5,
                  borderRadius: '12px',
                  py: 1.2,
                  borderColor: 'divider',
                  color: 'text.primary',
                  fontWeight: 'bold',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.02)', borderColor: 'text.primary' }
                }}
              >
                导入数据 (JSON)
              </Button>

              <Button
                fullWidth
                variant="text"
                color="error"
                onClick={() => setShowClearDialog(true)}
                sx={{
                  borderRadius: '12px',
                  py: 1,
                  fontWeight: 'bold',
                  textTransform: 'none',
                  fontSize: '0.875rem'
                }}
              >
                清除所有本地数据
              </Button>
            </CardContent>
          </Card>
        </Box>

        {/* 关于 */}
        <Box sx={{ mb: 3 }}>
          <Card 
            sx={{ 
              borderRadius: '16px', 
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontFamily: '"Poppins", sans-serif' }}>版本</Typography>
                <Typography variant="caption" color="text.secondary">{APP_VERSION} ({BUILD_NUMBER})</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' } }}>
                <Typography variant="body2" sx={{ fontFamily: '"Poppins", sans-serif' }}>隐私与条款</Typography>
                <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* 导入对话框 */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>导入数据</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            导入数据将覆盖所有现有数据，请确保已备份重要数据。
          </Alert>
          <Button variant="contained" component="label" fullWidth>
            选择文件
            <input type="file" accept=".json" hidden onChange={handleImportFile} />
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
          <Typography>确定要导入数据吗？这将覆盖所有现有数据。</Typography>
          {importData && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" display="block">导出时间: {new Date(importData.exportedAt).toLocaleString()}</Typography>
              <Typography variant="caption" display="block">记录数量: {importData.sessions?.length || 0}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportConfirmDialog(false)}>取消</Button>
          <Button onClick={handleConfirmImport} variant="contained" color="primary">确认导入</Button>
        </DialogActions>
      </Dialog>

      {/* 从云端恢复确认对话框 */}
      <Dialog open={showPullConfirmDialog} onClose={() => setShowPullConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>从云端恢复数据</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            恢复云端数据将覆盖所有本地现有数据。此操作不可恢复！
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPullConfirmDialog(false)}>取消</Button>
          <Button onClick={handlePullFromCloud} variant="contained" color="primary" disabled={syncLoading}>
            确认恢复
          </Button>
        </DialogActions>
      </Dialog>

      {/* 清除数据确认对话框 */}
      <Dialog open={showClearDialog} onClose={() => setShowClearDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>清除数据</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            此操作将删除所有本地数据。此操作不可恢复！
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearDialog(false)}>取消</Button>
          <Button onClick={handleClearData} variant="contained" color="error">确认清除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
