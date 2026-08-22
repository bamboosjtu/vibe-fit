import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initRepository } from './db/repository'
import { initializeServerConfig } from './services/serverConfig'
import './index.css'
import './App.css'

// 启动引导：在渲染前完成仓储初始化。
// - Web：惰性创建 DexieRepository（等价于无操作，幂等）。
// - Android：await SQLite 连接打开 + 建表/迁移，确保后续 getRepository() 可用。
//
// PWA Service Worker 由 vite-plugin-pwa 的 registerType: 'autoUpdate' 自动注册，
// 无需手动注册。autoUpdate 模式会在检测到新版本时自动 skipWaiting + clientsClaim，
// 确保用户始终拿到最新的构建产物。
async function bootstrap() {
  await initRepository();
  await initializeServerConfig();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
