import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initializeDB } from '../api/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database on startup
initializeDB();

// Create temporary upload directory for file processing
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// Upload and process file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const timestamp = parseInt(req.file.filename.split('-')[0]);
  const uploadTime = new Date(timestamp);
  const reportId = timestamp.toString();

  try {
    // Create placeholder HTML report
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
        <p><strong>Upload Time:</strong> ${uploadTime.toLocaleString()}</p>
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

    // Save to database
    await db.saveReport(reportId, originalName, uploadTime, placeholderHTML);

    // Clean up temp file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    res.json({
      success: true,
      id: reportId,
      fileName: originalName,
      uploadTime: uploadTime.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get upload history
app.get('/api/uploads', async (req, res) => {
  try {
    const files = await db.getAllReports();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific report
app.get('/api/report/:id', async (req, res) => {
  try {
    const report = await db.getReport(req.params.id);
    if (report) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(report.report_html);
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: 'neon-postgresql' });
});

// Serve React app in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
