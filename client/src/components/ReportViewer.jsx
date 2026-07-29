import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ReportViewer.css';

export default function ReportViewer({ reportId }) {
  const [htmlContent, setHtmlContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reportId) return;

    const loadReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`/api/report/${reportId}`, {
          responseType: 'text'
        });

        const content = response.data;

        // Validate response is HTML
        if (!content || typeof content !== 'string') {
          throw new Error('Invalid response format');
        }

        // Check if it's HTML (not JSON error)
        if (content.startsWith('{') && content.includes('error')) {
          try {
            const errorObj = JSON.parse(content);
            throw new Error(errorObj.error || 'Unknown error');
          } catch (parseErr) {
            // Continue if not valid JSON
          }
        }

        if (content.trim().length === 0) {
          setError('Report content is empty.');
        } else {
          setHtmlContent(content);
        }
      } catch (err) {
        console.error('Report load error:', err);

        if (err.response?.status === 404) {
          setError('Report not found. Try uploading the file again.');
        } else if (err.message?.includes('Database not initialized')) {
          setError('Database configuration error. Check your DATABASE_URL environment variable.');
        } else if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') {
          setError('Connection error. Check your internet connection.');
        } else {
          setError(`Error loading report: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportId]);

  if (loading) {
    return <div className="report-viewer loading">Loading report...</div>;
  }

  if (error) {
    return <div className="report-viewer error">{error}</div>;
  }

  return (
    <div className="report-viewer">
      {htmlContent ? (
        <iframe
          srcDoc={htmlContent}
          className="report-iframe"
          title="Generated Report"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      ) : (
        <div className="no-content">
          Report not yet available. Please wait or try uploading again.
        </div>
      )}
    </div>
  );
}
