import { NavLink, useLocation } from 'react-router-dom';

const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  ),
  explore: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  reels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path d="M10 8l6 4-6 4V8z" fill="currentColor" stroke="none" />
    </svg>
  ),
  create: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

export default function BottomNav() {
  const location = useLocation();
  const isReels = location.pathname === '/reels';

  if (isReels) {
    // Still show nav but semi-transparent
  }

  return (
    <nav className="bottom-nav" style={isReels ? { background: 'rgba(0,0,0,0.5)', borderTop: 'none' } : undefined}>
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        {icons.home}
        <span>Home</span>
      </NavLink>
      <NavLink to="/explore" className={({ isActive }) => (isActive ? 'active' : '')}>
        {icons.explore}
        <span>Explore</span>
      </NavLink>
      <NavLink to="/reels" className={({ isActive }) => (isActive ? 'active' : '')}>
        {icons.reels}
        <span>Reels</span>
      </NavLink>
      <NavLink to="/create" className={({ isActive }) => (isActive ? 'active' : '')}>
        {icons.create}
        <span>Create</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
        {icons.profile}
        <span>Profile</span>
      </NavLink>
    </nav>
  );
}
