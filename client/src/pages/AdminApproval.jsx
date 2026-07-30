import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminApproval.css';

export default function AdminApproval() {
  const [pendingSignups, setPendingSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPendingSignups();
  }, []);

  const fetchPendingSignups = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/pending-signups');
      setPendingSignups(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load pending signups');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (token, email) => {
    try {
      await axios.post(`/api/admin/approve-signup/${token}`);
      setMessage(`✓ Approved ${email}`);
      await fetchPendingSignups();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (token, email) => {
    if (!window.confirm(`Reject signup for ${email}?`)) return;
    try {
      await axios.post(`/api/admin/reject-signup/${token}`);
      setMessage(`✓ Rejected ${email}`);
      await fetchPendingSignups();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reject');
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1>Pending Signups</h1>
        <button onClick={fetchPendingSignups} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {message && <div className="admin-success">{message}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : pendingSignups.length === 0 ? (
        <div className="no-signups">
          <p>No pending signups</p>
        </div>
      ) : (
        <div className="signups-list">
          {pendingSignups.map((signup) => (
            <div key={signup.id} className="signup-card">
              <div className="signup-info">
                <div className="email">{signup.email}</div>
                <div className="time">
                  Requested: {new Date(signup.created_at).toLocaleString()}
                </div>
              </div>
              <div className="signup-actions">
                <button
                  onClick={() => handleApprove(signup.token, signup.email)}
                  className="approve-btn"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => handleReject(signup.token, signup.email)}
                  className="reject-btn"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
