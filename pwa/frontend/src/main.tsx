import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initRepository } from './db/repository'

// 启动引导：在渲染前完成仓储初始化。
// - Web：惰性创建 DexieRepository（等价于无操作，幂等）。
// - Android：await SQLite 连接打开 + 建表/迁移，确保后续 getRepository() 可用。
async function bootstrap() {
  await initRepository();

  // 注册 PWA Service Worker（保持原有逻辑）
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
