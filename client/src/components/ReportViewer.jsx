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
        if (typeof response.data === 'string' && response.data.trim().length > 0) {
          setHtmlContent(response.data);
        } else {
          setError('Report content is empty or invalid.');
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Report not found. Try uploading the file again.');
        } else {
          setError('Failed to load report. It may still be processing.');
        }
        console.error(err);
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
          sandbox="allow-same-origin"
        />
      ) : (
        <div className="no-content">
          Report not yet available. Please wait or try uploading again.
        </div>
      )}
    </div>
  );
}
