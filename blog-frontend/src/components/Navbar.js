import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';

export default function Navbar({ onLogout }) {
  const [name, setName] = useState('');
  const [isMemeAdmin, setIsMemeAdmin] = useState(false);
  const navigate = useNavigate();

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

  const logout = () => {
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
          <NavLink className={linkClass} to="/battles">Battles</NavLink>
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
