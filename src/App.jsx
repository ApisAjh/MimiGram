import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import BottomNav from './components/BottomNav';
import GatePage from './pages/GatePage';
import OnboardingPage from './pages/OnboardingPage';
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
  const { loading, needsTelegram, isAuthenticated, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (needsTelegram || !isAuthenticated) {
    return <GatePage />;
  }

  if (needsOnboarding) {
    return <OnboardingPage />;
  }

  return (
    <div className="app-shell">
      <Routes location={location} key={location.pathname}>
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
