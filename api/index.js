const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { db, initializeDB } = require('./db');

const app = express();

// Initialize database on startup
initializeDB();

// Multer config - store in /tmp temporarily
const storage = multer.diskStorage({
  destination: '/tmp',
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
  const uploadTime = new Date(timestamp).toISOString();
  const reportId = timestamp.toString();

  try {
    // Generate placeholder HTML report
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

    // Save to database
    await db.saveReport(reportId, originalName, new Date(uploadTime), placeholderHTML);

    // Clean up temp file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

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
app.get('/api/health', async (req, res) => {
  try {
    if (db.isReady()) {
      res.json({ status: 'ok', database: 'neon-postgresql', connected: true });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Database not initialized',
        databaseUrl: process.env.DATABASE_URL ? '✓ set' : '✗ not set'
      });
    }
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  try {
    const files = await db.getAllReports();
    res.json({
      status: 'ok',
      database: 'neon-postgresql',
      reportsCount: files.length,
      databaseUrl: process.env.DATABASE_URL ? '✓ configured' : '✗ not configured',
      files: files
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      databaseUrl: process.env.DATABASE_URL ? '✓ configured' : '✗ not configured'
    });
  }
});

// Test connection endpoint
app.get('/api/test-connection', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({
        error: 'DATABASE_URL not set',
        help: 'Set DATABASE_URL environment variable to your Neon connection string'
      });
    }

    const { pool } = require('./db');
    if (!pool) {
      return res.status(503).json({
        error: 'Database pool not initialized',
        message: 'The pg connection pool could not be created'
      });
    }

    const result = await pool.query('SELECT NOW()');
    res.json({
      success: true,
      message: 'Database connection successful',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(503).json({
      error: 'Database connection failed',
      message: error.message,
      code: error.code,
      databaseUrl: process.env.DATABASE_URL ? 'set' : 'not set'
    });
  }
});

// Serve React static files
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // Handle React Router - serve index.html for non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

module.exports = app;
