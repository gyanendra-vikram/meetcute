import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Discover from './pages/Discover';
import Profile from './pages/Profile';
import Matches from './pages/Matches';
import Battles from './pages/Battles';
import MemeHub from './pages/MemeHub';
import AdminMemes from './pages/AdminMemes';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import './dating.css';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    const handleStorageChange = () => {
      setIsLoggedIn(!!localStorage.getItem('token'));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <Router>
      {isLoggedIn && <Navbar onLogout={() => setIsLoggedIn(false)} />}

      <Routes>
        <Route
          path="/"
          element={
            isLoggedIn ? <Navigate to="/discover" replace /> : <Navigate to="/login" replace />
          }
        />

        <Route path="/login" element={<Login onLogin={() => setIsLoggedIn(true)} />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset" element={<ForgotPassword  />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/discover" element={<PrivateRoute><Discover /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/matches" element={<PrivateRoute><Matches /></PrivateRoute>} />
        <Route path="/battles" element={<PrivateRoute><Battles /></PrivateRoute>} />
        <Route path="/memes" element={<PrivateRoute><MemeHub /></PrivateRoute>} />
        <Route path="/admin/memes" element={<PrivateRoute><AdminMemes /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  );
}

export default App;
