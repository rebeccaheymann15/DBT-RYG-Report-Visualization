import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './components/FileUpload';
import ReportViewer from './components/ReportViewer';
import UploadHistory from './components/UploadHistory';
import './App.css';

export default function App() {
  const [uploads, setUploads] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dbReady, setDbReady] = useState(true);

  // Check database status on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get('/api/health');
        setDbReady(true);
      } catch (err) {
        setDbReady(false);
        setError('⚠️ Database not configured. Set DATABASE_URL environment variable.');
        console.error('Health check failed:', err);
      }
    };

    checkHealth();
  }, []);

  // Fetch upload history on mount
  useEffect(() => {
    if (dbReady) {
      fetchUploads();
    }
  }, [dbReady]);

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
      const response = await axios.post('/api/upload', formData);
      setSelectedReport(response.data.id);
      await fetchUploads();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>DBT RYG Report Visualization</h1>
        <p className="subtitle">Import Excel files to generate visual reports</p>
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
