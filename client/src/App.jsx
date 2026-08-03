import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Configure axios to send cookies with requests
axios.defaults.withCredentials = true;
import Login from './components/Login';
import FileUpload from './components/FileUpload';
import ReportViewer from './components/ReportViewer';
import UploadHistory from './components/UploadHistory';
import './App.css';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/status');
        if (response.data.authenticated) {
          setAuthenticated(true);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch upload history when authenticated
  useEffect(() => {
    if (authenticated) {
      fetchUploads();
    }
  }, [authenticated]);

  const fetchUploads = async () => {
    try {
      const response = await axios.get('/api/uploads');
      setUploads(response.data);
      if (response.data.length > 0) {
        setSelectedReport(response.data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch upload history');
      console.error(err);
    }
  };

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        withCredentials: true
      });
      setSelectedReport(response.data.id);
      await fetchUploads();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      setAuthenticated(false);
      setUploads([]);
      setSelectedReport(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (checkingAuth) {
    return <div className="app-loading">Loading...</div>;
  }

  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>DBT RYG Report Visualization</h1>
            <p className="subtitle">Import Excel files to generate visual reports</p>
          </div>
          <div className="header-actions">
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="layout">
          <aside className="sidebar">
            <FileUpload onUpload={handleUpload} loading={loading} />
            <UploadHistory
              uploads={uploads}
              selectedId={selectedReport}
              onSelect={setSelectedReport}
            />
          </aside>

          <section className="content">
            {error && <div className="error-banner">{error}</div>}
            {selectedReport && (
              <ReportViewer reportId={selectedReport} />
            )}
            {!selectedReport && (
              <div className="placeholder">
                <p>Upload an Excel file to generate a report</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
