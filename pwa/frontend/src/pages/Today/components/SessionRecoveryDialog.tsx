import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { WarningRounded } from '@mui/icons-material';
import { useSessionStore } from '../../../stores';
import { formatTimer } from '../../../domain/sessionTimer';

/**
 * 异常中断会话恢复对话框。
 *
 * 触发条件：运行中的会话超过 4 小时未 checkpoint，或跨自然日。
 *
 * 三个选项：
 * 1. 继续训练：排除长时间空白，从现在继续；
 * 2. 结束上次训练：结束于最后 checkpoint（保留已录入数据）；
 * 3. 放弃训练：删除 pending（不写入历史）。
 */
export function SessionRecoveryDialog() {
  const staleSession = useSessionStore(state => state.staleSession);
  const resolveStaleSession = useSessionStore(state => state.resolveStaleSession);

  const open = !!staleSession;

  const elapsedSeconds = staleSession?.elapsedSeconds ?? 0;
  const lastCheckpoint = staleSession?.lastCheckpointAt || staleSession?.runningSince;

  const handleContinue = () => resolveStaleSession('continue');
  const handleEnd = () => resolveStaleSession('end');
  const handleDiscard = () => resolveStaleSession('discard');

  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        // 不允许通过点击遮罩或 Esc 关闭，强制用户做出选择
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      }}
      maxWidth="sm"
      fullWidth
      data-testid="session-recovery-dialog"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningRounded color="warning" />
        检测到未完成的训练
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          上次训练似乎中断了较长时间（超过 4 小时或跨自然日）。为避免计时不准确，请选择如何处理。
        </Typography>
        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2">
            已记录时长：<strong>{formatTimer(elapsedSeconds)}</strong>
          </Typography>
          {lastCheckpoint && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              最后更新：{new Date(lastCheckpoint).toLocaleString('zh-CN')}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexDirection: 'column', gap: 1, p: 2, pt: 0 }}>
        <Button
          data-testid="recovery-continue"
          onClick={handleContinue}
          variant="contained"
          color="primary"
          fullWidth
        >
          继续训练（排除空白时间）
        </Button>
        <Button
          data-testid="recovery-end"
          onClick={handleEnd}
          variant="outlined"
          fullWidth
        >
          结束上次训练（保留已记录数据）
        </Button>
        <Button
          data-testid="recovery-discard"
          onClick={handleDiscard}
          color="error"
          fullWidth
        >
          放弃训练
        </Button>
      </DialogActions>
    </Dialog>
  );
}
