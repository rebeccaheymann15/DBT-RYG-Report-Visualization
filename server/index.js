const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const reportsDir = path.join(__dirname, 'reports');
const metadataFile = path.join(__dirname, 'data', 'metadata.json');

[uploadsDir, reportsDir, path.join(__dirname, 'data')].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer config for file uploads
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

// Helper to load metadata
function loadMetadata() {
  if (fs.existsSync(metadataFile)) {
    return JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  }
  return { files: [] };
}

// Helper to save metadata
function saveMetadata(metadata) {
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

// Upload and process file
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
    // For now, create a placeholder HTML report
    // This would be replaced with actual skill integration
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

    // Update metadata
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

// Get upload history
app.get('/api/uploads', (req, res) => {
  const metadata = loadMetadata();
  res.json(metadata.files);
});

// Get specific report
app.get('/api/report/:id', (req, res) => {
  const reportPath = path.join(reportsDir, `${req.params.id}.html`);
  if (fs.existsSync(reportPath)) {
    res.sendFile(reportPath);
  } else {
    res.status(404).json({ error: 'Report not found' });
  }
});

// Serve React app in production
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
