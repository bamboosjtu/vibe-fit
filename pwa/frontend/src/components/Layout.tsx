import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  ThemeProvider,
  CssBaseline,
  Typography,
} from '@mui/material';
import { lightTheme, darkTheme } from '../app/theme';
import { useSettingsStore } from '../stores';
import { WorkoutIcon } from './WorkoutArtwork';

interface LayoutProps {
  children: React.ReactNode;
}

// 导航项配置
const navItems = [
  { label: '今日', value: '/today', icon: 'today' as const },
  { label: '计划', value: '/plans', icon: 'plans' as const },
  { label: '历史', value: '/history', icon: 'history' as const },
  { label: '设置', value: '/settings', icon: 'settings' as const },
];

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { darkMode, initialize } = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      initialize();
      setTimeout(() => setMounted(true), 0);
    }
  }, [initialize]);

  if (!mounted) {
    return null;
  }

  const theme = darkMode ? darkTheme : lightTheme;

  // 根据当前路径确定选中的导航项
  const currentPath = location.pathname === '/' ? '/today' : location.pathname;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          height: '100dvh',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          overflow: 'hidden',
        }}
      >
        {/* 内容区域 */}
        <Box 
          sx={{ 
            flex: 1, 
            overflow: 'hidden',
            pb: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          }}
        >
          {children}
        </Box>
        
        {/* 底部导航栏 */}
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            borderRadius: 0,
            borderTop: 'none',
            background: 'background.paper',
            boxShadow: '0 -10px 32px rgba(15, 23, 42, 0.08)',
            pb: 'var(--safe-bottom)',
          }}
          elevation={0}
        >
          <BottomNavigation
            value={currentPath}
            onChange={(_, newValue) => navigate(newValue)}
            showLabels
            sx={{
              height: 'var(--bottom-nav-height)',
              bgcolor: 'transparent',
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '8px 0',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: 'transparent',
                },
              },
            }}
          >
            {navItems.map((item) => {
              const isSelected = currentPath === item.value;
              
              return (
                <BottomNavigationAction
                  key={item.value}
                  data-testid={`nav-${item.value.replace('/', '')}`}
                  label={
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-body)',
                        fontSize: '0.72rem',
                        fontWeight: isSelected ? 700 : 600,
                        mt: 0.5,
                        color: isSelected ? 'primary.main' : 'text.secondary',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {item.label}
                    </Typography>
                  }
                  value={item.value}
                  icon={
                    <Box
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {/* 选中状态背景 */}
                      {isSelected && (
                        <Box
                          sx={{
                            position: 'absolute',
                            width: 42,
                            height: 34,
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.12) 100%)',
                            animation: 'scaleIn 0.2s ease-out',
                          }}
                        />
                      )}
                      
                      {/* 图标 */}
                      <Box
                        sx={{
                          color: isSelected ? 'primary.main' : 'text.secondary',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                          zIndex: 1,
                        }}
                      >
                        <WorkoutIcon name={item.icon} size={24} />
                      </Box>
                      
                      {/* 选中指示器 */}
                      {isSelected && (
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: -8,
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            animation: 'scaleIn 0.3s ease-out',
                          }}
                        />
                      )}
                    </Box>
                  }
                  sx={{
                    color: 'text.secondary',
                    '&.Mui-selected': {
                      color: 'primary.main',
                    },
                  }}
                />
              );
            })}
          </BottomNavigation>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
