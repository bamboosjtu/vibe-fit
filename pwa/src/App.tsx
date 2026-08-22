import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TodayPage } from './pages/Today/TodayPage';
import { PlansPage } from './pages/Plans/PlansPage';
import { HistoryPage } from './pages/History/HistoryPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { AuthPage } from './pages/Auth/AuthPage';
import { isNativePlatform } from './db/repository';
import { getConfiguredServerOrigin } from './services/serverConfig';

function App() {
  const initialPath = isNativePlatform() && !getConfiguredServerOrigin()
    ? '/auth'
    : '/today';

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to={initialPath} replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
