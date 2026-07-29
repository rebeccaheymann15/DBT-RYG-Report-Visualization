# DBT RYG Report Visualization

A web application that allows users to import Excel files and generate visual DBT RYG (Red/Yellow/Green) status reports.

## Features

- **File Upload**: Drag-and-drop or click to upload Excel files
- **Report Generation**: Automatically generates visual reports from Excel data
- **Upload History**: View and select from previously uploaded files with timestamps
- **Report Viewer**: Display generated reports in an embedded iframe

## Project Structure

```
├── server/              # Node.js/Express backend
│   └── index.js        # Main server file
├── client/             # React frontend
│   ├── src/
│   │   ├── App.jsx     # Main App component
│   │   ├── App.css
│   │   └── components/ # React components
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── uploads/            # Uploaded Excel files
├── reports/            # Generated reports
├── data/               # Metadata storage
└── package.json        # Root package.json
```

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

2. **Set up directories**:
   The server will automatically create `uploads/`, `reports/`, and `data/` directories on first run.

## Development

Run the development server with both backend and frontend:

```bash
npm run dev
```

This will start:
- React dev server on `http://localhost:5173`
- Node.js server on `http://localhost:5000`

## Production

Build the frontend:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The server will serve the built React app from `client/dist/`.

## API Endpoints

- `POST /api/upload` - Upload an Excel file
- `GET /api/uploads` - Get upload history
- `GET /api/report/:id` - Get a specific report

## Environment Variables

Create a `.env` file if needed:

```
PORT=5000
NODE_ENV=development
```

## How It Works

1. User uploads an Excel file via the web interface
2. File is stored on the server with a timestamp
3. Server metadata tracks the file name and upload time
4. Report is generated (using the dx-delivery-health-report skill)
5. User can view the generated report in the main content area
6. Previous uploads appear in the history sidebar for quick access

## File Formats

Supported formats: `.xlsx` and `.xls`

## Notes

- Each file upload receives a unique timestamp-based ID
- File metadata is stored in `data/metadata.json`
- Generated reports are saved in the `reports/` directory
- Original uploaded files are kept in the `uploads/` directory for reference
