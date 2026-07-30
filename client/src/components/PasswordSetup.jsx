import React, { useState } from 'react';
import axios from 'axios';
import './AuthForm.css';

export default function PasswordSetup({ token, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`/api/auth/set-password/${token}`, {
        password,
        confirmPassword
      });

      if (response.data.success) {
        onSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>DX Project Portfolio</h1>
        <p className="auth-subtitle">Set Your Password</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (min 8 characters)"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              disabled={loading}
              required
            />
          </div>

          <div className="password-requirements">
            <p>Password must:</p>
            <ul>
              <li className={password.length >= 8 ? 'met' : ''}>Be at least 8 characters</li>
              <li className={password === confirmPassword && password ? 'met' : ''}>Match confirmation</li>
            </ul>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={loading || password.length < 8 || password !== confirmPassword}
            className="auth-button"
          >
            {loading ? 'Setting Password...' : 'Set Password & Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
