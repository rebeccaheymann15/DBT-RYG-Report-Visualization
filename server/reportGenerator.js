import XLSX from 'xlsx';

export function generateReport(filePath, fileName) {
  try {
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Parse portfolio data
    const reports = data
      .filter(row => {
        const projectStatus = row['Project Status'] || '';
        return projectStatus.trim() === 'In Progress';
      })
      .map(row => ({
        account: row['Account'] || 'Unknown',
        projectName: row['Project Name'] || '',
        projectManager: row['Project Manager'] || 'Unassigned',
        status: normalizeStatus(row['Project Overall'] || ''),
        eacMargin: parseFloat(row['EAC Margin %']) || 0,
        pmSummary: row['PM Status Summary'] || '',
        leadCommentary: row['Lead Commentary'] || '',
        coa: row['COA'] || '',
        waoc: row['WAOC'] || 'No',
        financials: row['Financials'] || '',
        scope: row['Scope'] || '',
        quality: row['Quality'] || '',
        resources: row['Resources'] || '',
        schedule: row['Schedule'] || '',
        clientRelationship: row['Client Relationship'] || ''
      }));

    // Count by status
    const redCount = reports.filter(r => r.status === 'red').length;
    const yellowCount = reports.filter(r => r.status === 'yellow').length;
    const greenCount = reports.filter(r => r.status === 'green').length;
    const totalCount = reports.length;

    // Get red accounts
    const redAccounts = reports.filter(r => r.status === 'red');

    // Get top yellow accounts (with priority logic)
    const yellowAccounts = reports
      .filter(r => r.status === 'yellow')
      .sort((a, b) => {
        // Priority: red sub-flags, negative margin, no PM, client relationship issues, WAOC
        const aScore = getYellowPriority(a);
        const bScore = getYellowPriority(b);
        return bScore - aScore;
      })
      .slice(0, 6);

    // Generate HTML
    const html = generateHTML({
      fileName,
      totalCount,
      redCount,
      yellowCount,
      greenCount,
      redAccounts,
      yellowAccounts
    });

    return html;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

function normalizeStatus(value) {
  const lower = (value || '').toLowerCase();
  if (lower.includes('red')) return 'red';
  if (lower.includes('yellow') || lower.includes('amber')) return 'yellow';
  if (lower.includes('green')) return 'green';
  return 'no-status';
}

function getYellowPriority(account) {
  let score = 0;
  if (account.financials?.toLowerCase().includes('red')) score += 100;
  if (account.schedule?.toLowerCase().includes('red')) score += 100;
  if (account.eacMargin < 0) score += 50;
  if (account.projectManager === 'Unassigned') score += 50;
  if (account.clientRelationship?.toLowerCase().includes('red')) score += 30;
  if (account.waoc === 'Yes') score += 20;
  return score;
}

function generateHTML({ fileName, totalCount, redCount, yellowCount, greenCount, redAccounts, yellowAccounts }) {
  const today = new Date();
  const weekOf = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DBT Delivery Health Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: #1a1a3e;
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-box {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-box .number {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
    .stat-box .label { color: #666; font-size: 12px; }
    .stat-box.red .number { color: #d32f2f; }
    .stat-box.yellow .number { color: #f57c00; }
    .stat-box.green .number { color: #388e3c; }
    .chart-container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      max-width: 400px;
    }
    .chart-container canvas { max-width: 100%; }
    .section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #1a1a3e;
      margin-bottom: 15px;
      font-size: 18px;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .account-card {
      border-left: 4px solid #ddd;
      padding: 15px;
      margin-bottom: 15px;
      background: #fafafa;
    }
    .account-card.red { border-left-color: #d32f2f; }
    .account-card.yellow { border-left-color: #f57c00; }
    .account-card.green { border-left-color: #388e3c; }
    .account-name { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
    .account-details { font-size: 12px; color: #666; }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DBT Delivery Health Report</h1>
      <p>Week of ${weekOf}</p>
      <p style="font-size: 12px; margin-top: 10px;">Source: ${fileName}</p>
    </div>

    <div class="stats">
      <div class="stat-box">
        <div class="label">Total Projects</div>
        <div class="number">${totalCount}</div>
      </div>
      <div class="stat-box green">
        <div class="label">Green</div>
        <div class="number">${greenCount}</div>
      </div>
      <div class="stat-box yellow">
        <div class="label">Yellow</div>
        <div class="number">${yellowCount}</div>
      </div>
      <div class="stat-box red">
        <div class="label">Red</div>
        <div class="number">${redCount}</div>
      </div>
    </div>

    <div class="chart-container">
      <canvas id="statusChart"></canvas>
    </div>

    ${redAccounts.length > 0 ? `
    <div class="section">
      <h2>Red Projects (${redAccounts.length})</h2>
      ${redAccounts.map(account => `
        <div class="account-card red">
          <div class="account-name">${account.account}</div>
          <div class="account-details">
            <p><strong>${account.projectName}</strong></p>
            <p>PM: ${account.projectManager}</p>
            ${account.pmSummary ? `<p>${account.pmSummary}</p>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${yellowAccounts.length > 0 ? `
    <div class="section">
      <h2>Emerging Risks - Yellow Projects (Top ${yellowAccounts.length} of ${yellowCount})</h2>
      ${yellowAccounts.map(account => `
        <div class="account-card yellow">
          <div class="account-name">${account.account}</div>
          <div class="account-details">
            <p><strong>${account.projectName}</strong></p>
            <p>PM: ${account.projectManager}</p>
            ${account.pmSummary ? `<p>${account.pmSummary}</p>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div class="footer">
      <p>Internal use only • Generated automatically • ${new Date().toLocaleString()}</p>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('statusChart').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Green', 'Yellow', 'Red'],
        datasets: [{
          data: [${greenCount}, ${yellowCount}, ${redCount}],
          backgroundColor: ['#388e3c', '#f57c00', '#d32f2f'],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  </script>
</body>
</html>
  `;
}
