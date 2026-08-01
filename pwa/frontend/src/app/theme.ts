import { createTheme } from '@mui/material/styles';

// 清新运动风配色方案
const colors = {
  // 主色调 - 渐变绿
  primary: {
    main: '#10B981',      // 翠绿色
    light: '#34D399',     // 浅绿
    dark: '#059669',      // 深绿
    contrastText: '#ffffff',
  },
  // 辅助色 - 清新蓝
  secondary: {
    main: '#06B6D4',      // 青色
    light: '#22D3EE',     // 浅青
    dark: '#0891B2',      // 深青
    contrastText: '#ffffff',
  },
  // 强调色
  success: {
    main: '#10B981',
    light: '#D1FAE5',
    dark: '#059669',
  },
  warning: {
    main: '#F59E0B',
    light: '#FEF3C7',
    dark: '#D97706',
  },
  error: {
    main: '#EF4444',
    light: '#FEE2E2',
    dark: '#DC2626',
  },
  info: {
    main: '#06B6D4',
    light: '#CFFAFE',
    dark: '#0891B2',
  },
  // 背景色
  background: {
    default: '#F8FAFC',   // 清爽移动端背景
    paper: '#FFFFFF',
  },
  // 文本色
  text: {
    primary: '#1F2937',
    secondary: '#6B7280',
    disabled: '#9CA3AF',
  },
  // 分割线
  divider: '#E5E7EB',
};

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    ...colors,
  },
  typography: {
    fontFamily: 'var(--font-body)',
    h1: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    h2: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    h3: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    h4: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    h5: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    h6: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    subtitle1: {
      fontFamily: 'var(--font-display)',
      fontWeight: 500,
    },
    subtitle2: {
      fontFamily: 'var(--font-display)',
      fontWeight: 500,
    },
    button: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          scrollBehavior: 'smooth',
        },
        body: {
          fontFamily: 'var(--font-body)',
          backgroundColor: '#F8FAFC',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          paddingBottom: 'var(--safe-bottom)',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          boxShadow: '0 -4px 20px rgba(16, 185, 129, 0.08)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: '#9CA3AF',
          '&.Mui-selected': {
            color: '#10B981',
          },
          '& .MuiBottomNavigationAction-label': {
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            marginTop: '4px',
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
          '& .MuiSvgIcon-root': {
            fontSize: '1.5rem',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
          border: '1px solid #E5E7EB',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(16, 185, 129, 0.12)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.95rem',
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
        },
        colorSuccess: {
          backgroundColor: '#D1FAE5',
          color: '#059669',
        },
        colorPrimary: {
          background: 'linear-gradient(135deg, #D1FAE5 0%, #CFFAFE 100%)',
          color: '#059669',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            '& fieldset': {
              borderColor: '#E5E7EB',
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderColor: '#10B981',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#10B981',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
        elevation3: {
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.08)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        indicator: {
          display: 'none',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          borderRadius: 12,
          margin: '4px',
          minHeight: 48,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&.Mui-selected': {
            backgroundColor: '#FFFFFF',
            color: '#1F2937',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          padding: '8px',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: '1.25rem',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '4px 0',
          '&:hover': {
            backgroundColor: '#F0FDF4',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          position: 'fixed',
          bottom: 90,
          right: 16,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)',
            boxShadow: '0 6px 24px rgba(16, 185, 129, 0.4)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
  },
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#34D399',
      light: '#6EE7B7',
      dark: '#10B981',
      contrastText: '#1F2937',
    },
    secondary: {
      main: '#22D3EE',
      light: '#67E8F9',
      dark: '#06B6D4',
      contrastText: '#1F2937',
    },
    success: {
      main: '#34D399',
      light: '#064E3B',
      dark: '#10B981',
    },
    warning: {
      main: '#FBBF24',
      light: '#78350F',
      dark: '#F59E0B',
    },
    error: {
      main: '#F87171',
      light: '#7F1D1D',
      dark: '#EF4444',
    },
    info: {
      main: '#22D3EE',
      light: '#164E63',
      dark: '#06B6D4',
    },
    background: {
      default: '#0B1220',
      paper: '#1E293B',
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
      disabled: '#64748B',
    },
    divider: '#334155',
  },
  typography: {
    fontFamily: 'var(--font-body)',
    h1: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    h2: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
    },
    h3: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    h4: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    h5: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    h6: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
    },
    subtitle1: {
      fontFamily: 'var(--font-display)',
      fontWeight: 500,
    },
    subtitle2: {
      fontFamily: 'var(--font-display)',
      fontWeight: 500,
    },
    button: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        '*': {
          boxSizing: 'border-box',
        },
        html: {
          scrollBehavior: 'smooth',
        },
        body: {
          fontFamily: 'var(--font-body)',
          backgroundColor: '#0B1220',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          paddingBottom: 'var(--safe-bottom)',
          backgroundColor: '#1E293B',
          borderTop: '1px solid #334155',
          boxShadow: '0 -4px 20px rgba(52, 211, 153, 0.08)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: '#64748B',
          '&.Mui-selected': {
            color: '#34D399',
          },
          '& .MuiBottomNavigationAction-label': {
            fontFamily: 'var(--font-body)',
            fontSize: '0.75rem',
            marginTop: '4px',
            '&.Mui-selected': {
              fontSize: '0.75rem',
            },
          },
          '& .MuiSvgIcon-root': {
            fontSize: '1.5rem',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 10px 30px rgba(2, 6, 23, 0.24)',
          border: '1px solid #334155',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 8px 30px rgba(52, 211, 153, 0.12)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.95rem',
          boxShadow: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(52, 211, 153, 0.25)',
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #34D399 0%, #22D3EE 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
          },
        },
        outlined: {
          borderWidth: '2px',
          '&:hover': {
            borderWidth: '2px',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
        },
        colorSuccess: {
          backgroundColor: '#064E3B',
          color: '#34D399',
        },
        colorPrimary: {
          background: 'linear-gradient(135deg, #064E3B 0%, #164E63 100%)',
          color: '#34D399',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#1E293B',
            '& fieldset': {
              borderColor: '#334155',
              borderWidth: '2px',
            },
            '&:hover fieldset': {
              borderColor: '#34D399',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#34D399',
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
        elevation3: {
          boxShadow: '0 4px 20px rgba(52, 211, 153, 0.08)',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        indicator: {
          display: 'none',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          borderRadius: 12,
          margin: '4px',
          minHeight: 48,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&.Mui-selected': {
            backgroundColor: '#1E293B',
            color: '#F1F5F9',
            boxShadow: '0 2px 8px rgba(52, 211, 153, 0.15)',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
          padding: '8px',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: '1.25rem',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '4px 0',
          '&:hover': {
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          position: 'fixed',
          bottom: 90,
          right: 16,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #34D399 0%, #22D3EE 100%)',
          boxShadow: '0 4px 20px rgba(52, 211, 153, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
            boxShadow: '0 6px 24px rgba(52, 211, 153, 0.4)',
            transform: 'scale(1.05)',
          },
        },
      },
    },
  },
});
