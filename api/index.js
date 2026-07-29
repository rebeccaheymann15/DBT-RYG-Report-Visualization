const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();

// Use /tmp for serverless function storage
const uploadsDir = '/tmp/uploads';
const reportsDir = '/tmp/reports';
const metadataFile = '/tmp/metadata.json';

[uploadsDir, reportsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer config
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  }
});

app.use(cors());
app.use(express.json());

// Helper functions
function loadMetadata() {
  if (fs.existsSync(metadataFile)) {
    return JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  }
  return { files: [] };
}

function saveMetadata(metadata) {
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

// API Routes
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const timestamp = parseInt(req.file.filename.split('-')[0]);
  const uploadTime = new Date(timestamp).toISOString();
  const reportId = timestamp.toString();

  try {
    const reportPath = path.join(reportsDir, `${reportId}.html`);

    const placeholderHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>DBT RYG Report - ${originalName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: #1a1a3e; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
    .content { background: white; padding: 20px; border-radius: 4px; }
    .info { background: #e8f4f8; border-left: 4px solid #0288d1; padding: 15px; margin: 20px 0; }
    .file-info { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DBT RYG Report</h1>
    <p>Report ID: ${reportId}</p>
  </div>
  <div class="content">
    <div class="info">
      <h3>File Information</h3>
      <div class="file-info">
        <p><strong>File Name:</strong> ${originalName}</p>
        <p><strong>Upload Time:</strong> ${new Date(uploadTime).toLocaleString()}</p>
        <p><strong>Report ID:</strong> ${reportId}</p>
      </div>
    </div>
    <div class="info">
      <h3>Status</h3>
      <p>Report generation in progress. The actual report visualization will appear here once the Excel file is processed.</p>
    </div>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(reportPath, placeholderHTML);

    const metadata = loadMetadata();
    metadata.files.unshift({
      id: reportId,
      originalName,
      uploadTime,
      fileName: req.file.filename,
      reportPath: `${reportId}.html`
    });
    saveMetadata(metadata);

    res.json({
      success: true,
      id: reportId,
      fileName: originalName,
      uploadTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/uploads', (req, res) => {
  const metadata = loadMetadata();
  res.json(metadata.files);
});

app.get('/api/report/:id', (req, res) => {
  const reportPath = path.join(reportsDir, `${req.params.id}.html`);
  if (fs.existsSync(reportPath)) {
    res.sendFile(reportPath);
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});

module.exports = app;
