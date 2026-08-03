import XLSX from 'xlsx';

export function generateReport(filePath, fileName) {
  try {
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Parse portfolio data
    console.log(`Total rows in Excel: ${data.length}`);
    if (data.length > 0) {
      console.log('Column names:', Object.keys(data[0]));
    }

    const projects = data
      .map(row => {
        // Parse COA field - handle both single values and CSV lists
        const coaString = (row['COA'] || '').trim();
        const coaArray = coaString
          .split(',')
          .map(c => c.trim().toLowerCase())
          .filter(c => c);

        return {
          projectName: row['Project Name'] || 'Unknown',
          account: row['Account'] || 'Unknown',
          projectManager: row['Project Manager'] || 'TBD',
          accountManager: row['Account Manager'] || '',
          billingType: row['Billing Type'] || '',
          coaArray: coaArray,
          coa: coaArray.join(', '),
          executiveOversight: row['Executive Oversight'] || 'No',
          statusUpdated: row['Status Updated'] || new Date().toLocaleDateString(),
          overallStatus: normalizeStatus(row['Project Overall'] || ''),
          financials: normalizeStatus(row['Financials'] || ''),
          scope: normalizeStatus(row['Scope'] || ''),
          quality: normalizeStatus(row['Quality'] || ''),
          resources: normalizeStatus(row['Resources'] || ''),
          schedule: normalizeStatus(row['Schedule'] || ''),
          clientRelationship: normalizeStatus(row['Client Relationship'] || ''),
          eacMargin: parseFloat(row['EAC Margin %']) || 0,
          odeMargin: parseFloat(row['ODE Margin %']) || 0,
          pmSummary: row['PM Status Summary'] || '',
          leadCommentary: row['Lead Commentary'] || '',
          waoc: row['WAOC'] || 'No'
        };
      });

    // Get unique COAs for filter - flatten all COA arrays and get unique values
    const coaSet = new Set();
    projects.forEach(p => {
      p.coaArray.forEach(coa => coaSet.add(coa));
    });
    const coaList = Array.from(coaSet).sort();

    // Generate HTML
    const html = generateHTML(projects, coaList, fileName);
    return html;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

function normalizeStatus(value) {
  const lower = (value || '').toLowerCase();
  if (lower.includes('red')) return 'Red';
  if (lower.includes('yellow') || lower.includes('amber')) return 'Yellow';
  if (lower.includes('green')) return 'Green';
  return 'Gray';
}

function getStatusColor(status) {
  switch(status) {
    case 'Green': return { bg: '#EAF3DE', border: '#639922', text: '#173404' };
    case 'Yellow': return { bg: '#FEF3C7', border: '#D97706', text: '#92400E' };
    case 'Red': return { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' };
    default: return { bg: '#F3F4F6', border: '#D1D5DB', text: '#374151' };
  }
}

function generateHTML(projects, coaList, fileName) {
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const projectCards = projects.map((project, idx) => {
    const overallColor = getStatusColor(project.overallStatus);
    const otherStatuses = [
      { label: 'Financials', value: project.financials },
      { label: 'Scope', value: project.scope },
      { label: 'Quality', value: project.quality },
      { label: 'Resources', value: project.resources },
      { label: 'Schedule', value: project.schedule },
      { label: 'Client relationship', value: project.clientRelationship }
    ];

    return `
    <section class="card" data-coa-list='${JSON.stringify(project.coaArray)}'>
      <div class="card-header">
        <div>
          <h2>${project.projectName}</h2>
          <div class="subline">${project.account}</div>
        </div>
        <div class="header-meta">
          <div><span class="meta-label">Status updated</span> ${project.statusUpdated}</div>
          <div><span class="meta-label">Data refreshed</span> ${formattedDate}</div>
        </div>
      </div>

      <div class="status-row">
        <div class="status-box status-box-full" style="background:${overallColor.bg}; color:${overallColor.text}; border:1px solid ${overallColor.border};">
          <div class="status-label">Overall Project</div>
          <div class="status-value">${project.overallStatus}</div>
        </div>
      </div>

      <div class="status-grid">
        ${otherStatuses.map(s => {
          const color = getStatusColor(s.value);
          return `
        <div class="status-box" style="background:${color.bg}; color:${color.text}; border:1px solid ${color.border};">
          <div class="status-label">${s.label}</div>
          <div class="status-value">${s.value}</div>
        </div>
          `;
        }).join('')}
      </div>

      <div class="info-grid">
        <div><span class="meta-label">Project manager</span><br>${project.projectManager}</div>
        <div><span class="meta-label">Account manager</span><br>${project.accountManager || 'TBD'}</div>
        <div><span class="meta-label">Billing type</span><br>${project.billingType || 'N/A'}</div>
        <div><span class="meta-label">COA</span><br>${project.coa.toUpperCase()}</div>
        <div><span class="meta-label">Executive oversight</span><br>${project.executiveOversight}</div>
        <div><span class="meta-label">EAC Margin</span><br>${project.eacMargin ? project.eacMargin.toFixed(1) + '%' : 'N/A'}</div>
        <div><span class="meta-label">ODE Margin</span><br>${project.odeMargin ? project.odeMargin.toFixed(1) + '%' : 'N/A'}</div>
      </div>

      ${project.pmSummary || project.leadCommentary ? `
      <div>
        ${project.pmSummary ? `
        <div>
          <div class="summary-label">PM Status Summary</div>
          <div class="summary-text">${project.pmSummary}</div>
        </div>
        ` : ''}
        ${project.leadCommentary ? `
        <div class="commentary">
          <div class="commentary-label">Lead Commentary</div>
          <div class="commentary-text">${project.leadCommentary}</div>
        </div>
        ` : ''}
      </div>
      ` : ''}
    </section>
    `;
  }).join('');

  const coaCheckboxes = coaList.map(coa => {
    const displayName = coa === 'xd' ? 'XD' : coa === 'dpe' ? 'DPE' : coa.charAt(0).toUpperCase() + coa.slice(1);
    return `<label class="coa-chip" data-value="${coa}"><input type="checkbox" value="${coa}"> ${displayName}</label>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>DX Project Portfolio</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background:#F1EFE8; margin:0; padding:32px; color:#2C2C2A; }
  .page-title { font-size:22px; font-weight:600; margin-bottom:4px; }
  .page-subtitle { font-size:13px; color:#5F5E5A; margin-bottom:24px; }
  .card { background:#fff; border:1px solid #D3D1C7; border-radius:8px; padding:20px 24px; margin-bottom:24px; }
  .card.hidden { display:none; }
  .card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
  .card-header h2 { font-size:18px; margin:0; }
  .subline { font-size:13px; color:#5F5E5A; margin-top:2px; }
  .header-meta { text-align:right; font-size:13px; line-height:1.6; }
  .meta-label { font-size:11px; text-transform:uppercase; letter-spacing:0.03em; color:#888780; display:block; }
  .status-row { display:flex; gap:8px; margin-bottom:16px; }
  .status-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:16px; }
  .status-box { border-radius:6px; padding:8px 10px; }
  .status-box-full { width:100%; }
  .status-label { font-size:11px; font-weight:600; }
  .status-value { font-size:13px; margin-top:2px; }
  .info-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; font-size:13px; margin-bottom:16px; border-top:1px solid #E1E0D9; border-bottom:1px solid #E1E0D9; padding:12px 0; }
  .summary-label, .commentary-label { font-size:11px; text-transform:uppercase; letter-spacing:0.03em; color:#888780; margin-bottom:4px; margin-top:12px; }
  .summary-text, .commentary-text { font-size:13px; line-height:1.5; }
  .commentary { margin-top:12px; }
  .filter-bar { display:flex; align-items:flex-start; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
  .filter-bar > label { font-size:13px; font-weight:600; padding-top:8px; }
  .coa-checks { display:flex; gap:6px; flex-wrap:wrap; }
  .coa-chip { display:flex; align-items:center; gap:5px; font-size:13px; border:1px solid #B4B2A9; border-radius:999px; padding:5px 12px; cursor:pointer; background:#fff; user-select:none; }
  .coa-chip input { margin:0; }
  .coa-chip.checked { background:#E6F1FB; border-color:#378ADD; color:#0C447C; }
  .clear-btn { font-size:12px; color:#5F5E5A; background:none; border:1px solid #D3D1C7; border-radius:6px; padding:5px 10px; cursor:pointer; }
  .no-results { font-size:14px; color:#5F5E5A; padding:24px; text-align:center; display:none; }
</style>
</head>
<body>
  <div class="page-title">DX project portfolio</div>
  <div class="page-subtitle">${projects.length} project(s) total · generated ${formattedDate} ${formattedTime} from ${fileName}</div>

  <div class="filter-bar">
    <label>Filter by COA</label>
    <div class="coa-checks" id="coa-checks">
      ${coaCheckboxes}
    </div>
    <button class="clear-btn" id="clear-filter" type="button">Clear</button>
    <span id="match-count" style="font-size:13px; color:#5F5E5A;"></span>
  </div>

  <div id="card-list">
    ${projectCards}
  </div>

  <div class="no-results" id="no-results">No projects match the selected filters</div>

  <script>
    const coaChecks = document.querySelectorAll('.coa-chip');
    const clearBtn = document.getElementById('clear-filter');
    const cardList = document.getElementById('card-list');
    const noResults = document.getElementById('no-results');
    const matchCount = document.getElementById('match-count');

    function updateFilter() {
      const selectedCoAs = Array.from(coaChecks)
        .filter(chip => chip.querySelector('input').checked)
        .map(chip => chip.dataset.value);

      const cards = cardList.querySelectorAll('.card');
      let visibleCount = 0;

      cards.forEach(card => {
        const projectCoAs = JSON.parse(card.dataset.coaList || '[]');
        const hasMatchingCOA = selectedCoAs.length === 0 ||
          selectedCoAs.some(selected => projectCoAs.includes(selected));

        if (hasMatchingCOA) {
          card.classList.remove('hidden');
          visibleCount++;
        } else {
          card.classList.add('hidden');
        }
      });

      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
      matchCount.textContent = visibleCount > 0 ? \`(\${visibleCount} project(s))\` : '';
    }

    coaChecks.forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          e.preventDefault();
          chip.querySelector('input').checked = !chip.querySelector('input').checked;
        }
        chip.classList.toggle('checked', chip.querySelector('input').checked);
        updateFilter();
      });
      chip.querySelector('input').addEventListener('change', () => {
        chip.classList.toggle('checked', chip.querySelector('input').checked);
        updateFilter();
      });
    });

    clearBtn.addEventListener('click', () => {
      coaChecks.forEach(chip => {
        chip.querySelector('input').checked = false;
        chip.classList.remove('checked');
      });
      updateFilter();
    });

    matchCount.textContent = \`(\${cardList.querySelectorAll('.card').length} project(s))\`;
  </script>
</body>
</html>
  `;
}
