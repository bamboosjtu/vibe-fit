import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { FitnessCenter } from '@mui/icons-material';

interface LoadingStateProps {
  /** 自定义图标，默认为 FitnessCenter */
  icon?: ReactNode;
  /** 自定义文案 */
  text?: string;
}

/**
 * 全局共享的加载占位组件。
 *
 * 用于页面初始化、数据加载等待时的占位显示，统一样式与动画。
 */
export function LoadingState({ icon, text = '加载中...' }: LoadingStateProps) {
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
        {icon ?? <FitnessCenter sx={{ color: 'white', fontSize: 24 }} />}
      </Box>
      <Typography
        sx={{
          color: 'text.secondary',
          fontFamily: '"Nunito", sans-serif',
          fontWeight: 600,
        }}
      >
        {text}
      </Typography>
    </Box>
  );
}
