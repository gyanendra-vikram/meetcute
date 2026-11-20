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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-xl text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Verify your email</h2>
        {status === 'idle' && (
          <p className="mb-6 text-gray-700">
            Click below to verify your email address and activate your account.
          </p>
        )}
        {message && <p className="mb-6 text-gray-700">{message}</p>}
        {status === 'idle' && (
          <button
            type="button"
            onClick={handleVerify}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition duration-200"
          >
            Verify Email
          </button>
        )}
        {status === 'loading' && <p className="mb-6 text-gray-700">Verifying email...</p>}
        {(status === 'success' || status === 'error') && (
          <Link to="/login" className="text-blue-600 hover:underline">
            Go to login
          </Link>
        )}
      </div>
    </div>
  );
}
