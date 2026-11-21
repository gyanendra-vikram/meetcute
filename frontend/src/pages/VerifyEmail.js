import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../utils/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  const handleVerify = async () => {
    if (!token) {
      setStatus('error');
      setMessage('This verification link is missing its token.');
      return;
    }

    setStatus('loading');
    try {
      const response = await API.post('/auth/verify-email', { token });
      setMessage(response.data.msg);
      setStatus('success');
    } catch (error) {
      setMessage(error.response?.data?.msg || 'Unable to verify this email.');
      setStatus('error');
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" to="/login"><span aria-hidden="true">♡</span>battle<span>meet</span></Link>
        <h1>Verify your email</h1>
        <p className={`auth-intro${status === 'error' ? ' auth-message-error' : status === 'success' ? ' auth-message-success' : ''}`}>
          {message || (status === 'loading'
            ? 'Verifying your email…'
            : 'Click below to verify your email address and activate your account.')}
        </p>
        {(status === 'idle' || status === 'loading') && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={status === 'loading'}
            className="button button-primary auth-submit"
          >
            {status === 'loading' ? 'Verifying…' : 'Verify email'}
          </button>
        )}
        {(status === 'success' || status === 'error') && (
          <p className="auth-footer"><Link to="/login">Go to sign in</Link></p>
        )}
      </section>
    </main>
  );
}
