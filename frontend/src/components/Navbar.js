import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';
import {
  clearReadMatches,
  getUnreadMatchCount,
  markMatchesRead,
  MATCH_NOTIFICATION_EVENT,
  notifyMatch,
} from '../utils/matchNotifications';

export default function Navbar({ onLogout }) {
  const [name, setName] = useState('');
  const [isMemeAdmin, setIsMemeAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadBattleCount, setUnreadBattleCount] = useState(0);
  const knownMatchIds = useRef(null);
  const matchPollErrorShown = useRef(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await API.get('/auth/me');
        setName(data.name);
        setIsMemeAdmin(Boolean(data.isMemeAdmin));
      } catch (error) {
        toast.error(error.response?.data?.msg || 'Could not load your account');
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    let active = true;
    let checking = false;
    if (location.pathname === '/battles') {
      markMatchesRead([...(knownMatchIds.current || [])].map((_id) => ({ _id })));
      setUnreadBattleCount(0);
    }

    const checkForMatches = async () => {
      if (checking) return;
      checking = true;
      try {
        const { data } = await API.get('/dating/matches');
        if (!active) return;
        if (!Array.isArray(data)) throw new Error('Unexpected matches response');

        if (knownMatchIds.current) {
          data.forEach((match) => {
            if (!knownMatchIds.current.has(String(match._id))) notifyMatch(match);
          });
        }
        knownMatchIds.current = new Set(data.map((match) => String(match._id)));
        if (location.pathname === '/battles') {
          markMatchesRead(data);
          setUnreadBattleCount(0);
        } else {
          setUnreadBattleCount(getUnreadMatchCount(data));
        }
        matchPollErrorShown.current = false;
      } catch (error) {
        if (active && !matchPollErrorShown.current) {
          toast.error(error.response?.data?.msg || error.message || 'Could not check for new matches');
          matchPollErrorShown.current = true;
        }
      } finally {
        checking = false;
      }
    };

    const handleMatchNotification = (event) => {
      if (location.pathname === '/battles') {
        markMatchesRead([
          ...[...(knownMatchIds.current || [])].map((_id) => ({ _id })),
          { _id: event.detail?.matchId },
        ]);
        setUnreadBattleCount(0);
      } else {
        setUnreadBattleCount((count) => count + 1);
      }
    };

    checkForMatches();
    const interval = window.setInterval(checkForMatches, 10000);
    window.addEventListener('focus', checkForMatches);
    window.addEventListener(MATCH_NOTIFICATION_EVENT, handleMatchNotification);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', checkForMatches);
      window.removeEventListener(MATCH_NOTIFICATION_EVENT, handleMatchNotification);
    };
  }, [location.pathname]);

  const logout = () => {
    clearReadMatches();
    localStorage.removeItem('token');
    onLogout();
    toast.info('You have been logged out');
    navigate('/login');
  };

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`;

  return (
    <nav className="topbar">
      <div className="topbar-inner">
        <Link className="brand" to="/discover" aria-label="BattleMeet home">
          <span className="brand-mark" aria-hidden="true">♡</span>
          <span>battle<span className="brand-accent">meet</span></span>
        </Link>
        <div className="nav-links">
          <NavLink className={linkClass} to="/discover">Discover</NavLink>
          <NavLink className={linkClass} to="/matches">Matches</NavLink>
          <NavLink
            className={linkClass}
            to="/battles"
            aria-label={unreadBattleCount
              ? `Battles, ${unreadBattleCount} unread notification${unreadBattleCount === 1 ? '' : 's'}`
              : undefined}
          >
            Battles
            {unreadBattleCount > 0 && (
              <span className="nav-notification-badge" aria-hidden="true">
                {unreadBattleCount > 9 ? '9+' : unreadBattleCount}
              </span>
            )}
          </NavLink>
          <NavLink className={linkClass} to="/memes">Meme Hub</NavLink>
          {isMemeAdmin && <NavLink className={linkClass} to="/admin/memes">Admin</NavLink>}
          <NavLink className={linkClass} to="/profile">My profile</NavLink>
        </div>
        <div className="nav-account">
          <span className="nav-greeting">{name ? `Hi, ${name.split(' ')[0]}` : 'Welcome'}</span>
          <button className="logout-button" onClick={logout}>Log out</button>
        </div>
      </div>
    </nav>
  );
}
