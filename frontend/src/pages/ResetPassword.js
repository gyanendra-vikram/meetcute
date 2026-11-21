import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await API.post('/auth/reset-password', { token, newPassword });
      toast.success(response.data.msg || 'Password reset successful.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.msg || 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/login"><span aria-hidden="true">♡</span>battle<span>meet</span></Link>
        <h1>Reset your password</h1>
        <p className="auth-intro">Choose a new password for your account.</p>
        {token ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              name="newPassword"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
            />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              name="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              autoComplete="new-password"
              className="auth-input"
            />
            <button type="submit" disabled={isSubmitting} className="button button-primary auth-submit">
              {isSubmitting ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        ) : (
          <p className="auth-intro">
            This reset link is missing its token. Request a new one below.
          </p>
        )}
        <p className="auth-footer">
          <Link to="/reset">
            Request a new reset link
          </Link>
        </p>
      </section>
    </main>
  );
}
