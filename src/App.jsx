import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import BottomNav from './components/BottomNav';
import GatePage from './pages/GatePage';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ReelsPage from './pages/ReelsPage';
import CreatePage from './pages/CreatePage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import UserProfilePage from './pages/UserProfilePage';

function LoadingScreen() {
  return (
    <div className="gate-page">
      <div className="logo">MimiGram</div>
      <div className="spinner" />
    </div>
  );
}

export default function App() {
  const { loading, needsTelegram, isAuthenticated } = useAuth();

  if (loading) return <LoadingScreen />;

  if (needsTelegram || !isAuthenticated) {
    return <GatePage />;
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/reels" element={<ReelsPage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:id" element={<UserProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
