import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { db, initializeDB } from '../api/db.js';
import { generateReport } from './reportGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database on startup
await initializeDB();

// Create temporary upload directory for file processing
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Session store using PostgreSQL
const pgSessionStore = pgSession(session);
const sessionStore = new pgSessionStore({
  pool: db.getPool(),
  createTableIfMissing: true,
  tableName: 'session'
});

// Session middleware
const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
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

app.use(sessionMiddleware);
app.use(cors({
  credentials: true,
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    // Also allow localhost for development
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    // For production, allow the same origin
    callback(null, true);
  }
}));
app.use(express.json());

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  console.log('Auth check:', {
    path: req.path,
    method: req.method,
    sessionId: req.sessionID,
    userId: req.session?.userId,
    allSessionKeys: Object.keys(req.session || {}),
    hasCookie: !!req.headers.cookie
  });
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// ============ AUTHENTICATION ENDPOINTS ============

// Simple password login
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  // Get app password from environment (fallback to default)
  const appPassword = process.env.APP_PASSWORD || 'password';

  if (password !== appPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate a simple user ID for session
  req.session.userId = 'user-' + Date.now();
  req.session.authenticated = true;

  console.log('Login: Setting session', {
    sessionId: req.sessionID,
    userId: req.session.userId,
    authenticated: req.session.authenticated
  });

  req.session.save((err) => {
    if (err) {
      console.error('Login: Error saving session:', err);
      return res.status(500).json({ error: 'Failed to save session' });
    }
    console.log('Login: Session saved successfully', { sessionId: req.sessionID });
    res.json({
      success: true,
      message: 'Logged in successfully'
    });
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// ============ PROTECTED ENDPOINTS ============

// Log all /api/upload requests
app.post('/api/upload', (req, res, next) => {
  console.log('Upload request received:', {
    url: req.url,
    headers: {
      'content-type': req.headers['content-type'],
      'cookie': req.headers.cookie ? 'present' : 'missing'
    },
    sessionID: req.sessionID,
    userId: req.session?.userId
  });
  next();
});

// Upload and process file (protected)
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const timestamp = parseInt(req.file.filename.split('-')[0]);
  const uploadTime = new Date(timestamp);
  const reportId = timestamp.toString();

  try {
    // Generate report from Excel file
    let reportHTML;
    try {
      reportHTML = generateReport(filePath, originalName);
    } catch (error) {
      console.error('Error generating report:', error);
      reportHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report Generation Error</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .error { background: #fee; border: 1px solid #fcc; color: #c33; padding: 20px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="error">
    <h3>Report Generation Error</h3>
    <p>Could not process file: ${originalName}</p>
    <p>${error.message}</p>
  </div>
</body>
</html>
      `;
    }

    await db.saveReport(reportId, originalName, uploadTime, reportHTML);

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

// Get upload history (protected)
app.get('/api/uploads', requireAuth, async (req, res) => {
  try {
    const files = await db.getAllReports();
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific report (protected)
app.get('/api/report/:id', requireAuth, async (req, res) => {
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
