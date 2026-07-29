import React from 'react';
import './UploadHistory.css';

export default function UploadHistory({ uploads, selectedId, onSelect }) {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  return (
    <div className="upload-history">
      <h3>Upload History</h3>
      {uploads.length === 0 ? (
        <p className="no-uploads">No uploads yet</p>
      ) : (
        <div className="history-list">
          {uploads.map((upload) => {
            const { date, time } = formatDate(upload.uploadTime);
            const isSelected = upload.id === selectedId;
            return (
              <div
                key={upload.id}
                className={`history-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(upload.id)}
              >
                <div className="item-content">
                  <div className="item-name" title={upload.originalName}>
                    {upload.originalName}
                  </div>
                  <div className="item-timestamp">
                    <span className="date">{date}</span>
                    <span className="separator">•</span>
                    <span className="time">{time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
