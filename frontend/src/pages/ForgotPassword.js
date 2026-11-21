import { useState } from 'react';
import API from '../utils/api';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/forgot-password', { email });
      toast.success('Password reset link sent to your email.');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Error sending reset link.');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/login"><span aria-hidden="true">♡</span>battle<span>meet</span></Link>
        <h1>Forgot password?</h1>
        <p className="auth-intro">Enter your email and we’ll send you a link to reset your password.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            name="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="auth-input"
          />
          <button type="submit" className="button button-primary auth-submit">
            Send reset link
          </button>
        </form>
        <p className="auth-footer">
          Remembered your password? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
