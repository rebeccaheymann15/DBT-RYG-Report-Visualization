import React, { useState } from 'react';
import axios from 'axios';
import './AuthForm.css';

export default function ForgotPassword({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/forgot-password', { email });
      setSuccess('If this email exists, a password reset link has been sent.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>DX Project Portfolio</h1>
        <p className="auth-subtitle">Reset Password</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
              disabled={loading || !!success}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button
            type="submit"
            disabled={loading || !!success}
            className="auth-button"
          >
            {loading ? 'Sending Link...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="auth-footer">
          <p><button onClick={onSwitchToLogin} className="link-button">Back to Login</button></p>
        </div>
      </div>
    </div>
  );
}
