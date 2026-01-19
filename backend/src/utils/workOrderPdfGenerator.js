const puppeteer = require('puppeteer');

/**
 * Generate Work Order PDF for technicians
 * Professional, printable format with checklist
 */
async function generateWorkOrderPDF(workOrderData) {
  let browser;
  try {
    console.log('🚀 Launching Puppeteer for Work Order PDF...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });

    const htmlContent = generateWorkOrderHTML(workOrderData);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.3in',
        right: '0.4in',
        bottom: '0.3in',
        left: '0.4in'
      }
    });

    console.log(`✅ Work Order PDF generated (${pdfBuffer.length} bytes)`);
    return pdfBuffer;

  } catch (error) {
    console.error('❌ Error generating Work Order PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate HTML template for Work Order
 */
function generateWorkOrderHTML(wo) {
  const priorityColor = {
    critical: '#dc3545',
    high: '#fd7e14',
    medium: '#ffc107',
    low: '#28a745'
  }[wo.priority] || '#6c757d';

  const priorityIcon = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  }[wo.priority] || '⚪';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Work Order ${wo.work_order_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.4;
      color: #000;
      background: #fff;
    }

    .page {
      padding: 10px;
      max-width: 100%;
      margin: 0 auto;
    }

    /* Header */
    .header {
      border-bottom: 4px solid #0066A1;
      padding-bottom: 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: start;
    }

    .header-left h1 {
      color: #0066A1;
      font-size: 28px;
      margin-bottom: 5px;
    }

    .header-left .company {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .header-right {
      text-align: right;
    }

    .wo-number {
      font-size: 24px;
      font-weight: bold;
      color: #0066A1;
      margin-bottom: 5px;
    }

    .priority-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      color: white;
      background: ${priorityColor};
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .info-item {
      display: flex;
      flex-direction: column;
    }

    .info-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 3px;
    }

    .info-value {
      font-size: 14px;
      font-weight: 500;
      color: #000;
    }

    /* Section */
    .section {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #0066A1;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 2px solid #FF6600;
    }

    .section-content {
      padding: 6px;
      background: #fff;
    }

    .description-box {
      padding: 8px;
      background: #f8f9fa;
      border-left: 3px solid #0066A1;
      margin-bottom: 8px;
      border-radius: 3px;
      font-size: 12px;
    }

    /* Checklist */
    .checklist {
      list-style: none;
      padding: 0;
    }

    .checklist-item {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      margin-bottom: 4px;
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 3px;
      font-size: 12px;
    }

    .checkbox {
      width: 18px;
      height: 18px;
      border: 2px solid #0066A1;
      border-radius: 3px;
      margin-right: 8px;
      flex-shrink: 0;
    }

    .checkbox.checked {
      background: #28a745;
      border-color: #28a745;
      position: relative;
    }

    .checkbox.checked::after {
      content: '✓';
      color: white;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 18px;
      font-weight: bold;
    }

    .checklist-item.completed {
      opacity: 0.6;
    }

    .checklist-item.completed .task-text {
      text-decoration: line-through;
    }

    /* Parts Table */
    .parts-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .parts-table th {
      background: #0066A1;
      color: white;
      padding: 10px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
    }

    .parts-table td {
      padding: 10px;
      border-bottom: 1px solid #dee2e6;
      font-size: 13px;
    }

    .parts-table tr:nth-child(even) {
      background: #f8f9fa;
    }

    /* Notes Section */
    .notes-section {
      margin-top: 10px;
      page-break-inside: avoid;
    }

    .notes-box {
      border: 1px solid #dee2e6;
      border-radius: 3px;
      min-height: 320px;
      padding: 10px;
      background: #fff;
    }

    .notes-lines {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .notes-line {
      border-bottom: 1px solid #dee2e6;
      height: 18px;
    }

    /* Signature Section */
    .signature-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-top: 15px;
      page-break-inside: avoid;
    }

    .signature-box {
      border: 2px solid #000;
      padding: 8px;
      border-radius: 3px;
    }

    .signature-label {
      font-size: 10px;
      color: #666;
      margin-bottom: 3px;
      font-weight: bold;
    }

    .signature-line {
      border-top: 2px solid #000;
      margin: 25px 0 6px 0;
    }

    .signature-date {
      font-size: 9px;
      color: #666;
    }

    /* Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #dee2e6;
      text-align: center;
      font-size: 12px;
      color: #666;
    }

    /* Print Optimization */
    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>WORK ORDER</h1>
        <div class="company">Fiserv Inventory Management</div>
      </div>
      <div class="header-right">
        <div class="wo-number">${wo.work_order_number}</div>
        <div class="priority-badge">${priorityIcon} ${wo.priority.toUpperCase()}</div>
      </div>
    </div>

    <!-- Work Order Info -->
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Title</div>
        <div class="info-value">${wo.title}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Work Type</div>
        <div class="info-value">${formatWorkType(wo.work_type)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Machine</div>
        <div class="info-value">${wo.machine_name || 'Not Assigned'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Location</div>
        <div class="info-value">${wo.machine_location || '-'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Assigned To</div>
        <div class="info-value">${wo.technician_name || 'Unassigned'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Due Date</div>
        <div class="info-value">${wo.due_date ? new Date(wo.due_date).toLocaleDateString() : 'Not Set'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Estimated Time</div>
        <div class="info-value">${wo.estimated_hours ? wo.estimated_hours + ' hours' : 'Not Set'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Date</div>
        <div class="info-value">${new Date().toLocaleDateString()}</div>
      </div>
    </div>

    <!-- Description -->
    ${wo.description ? `
    <div class="section">
      <div class="section-title">Description</div>
      <div class="description-box">
        ${wo.description}
      </div>
    </div>
    ` : ''}

    <!-- Tasks Checklist -->
    ${wo.tasks && wo.tasks.length > 0 ? `
    <div class="section">
      <div class="section-title">Tasks to Complete (${wo.tasks.filter(t => t.is_completed).length}/${wo.tasks.length})</div>
      <ul class="checklist">
        ${wo.tasks.map(task => `
          <li class="checklist-item ${task.is_completed ? 'completed' : ''}">
            <div class="checkbox ${task.is_completed ? 'checked' : ''}"></div>
            <div class="task-text">${task.task_description}</div>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Parts Required -->
    ${wo.parts && wo.parts.length > 0 ? `
    <div class="section">
      <div class="section-title">Parts Required</div>
      <table class="parts-table">
        <thead>
          <tr>
            <th>Part Name</th>
            <th>Part Number</th>
            <th>Quantity Required</th>
            <th>Qty Used</th>
          </tr>
        </thead>
        <tbody>
          ${wo.parts.map(part => `
            <tr>
              <td><strong>${part.part_name || 'Unknown'}</strong></td>
              <td>${part.part_number || '-'}</td>
              <td>${part.quantity_required}</td>
              <td style="border-left: 2px solid #0066A1;">_______</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Technician Notes -->
    <div class="section notes-section">
      <div class="section-title">Technician Notes / Work Performed</div>
      <div class="notes-box">
        <div class="notes-lines">
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
          <div class="notes-line"></div>
        </div>
      </div>
    </div>

    <!-- Signatures -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label"><strong>Technician Signature</strong></div>
        <div class="signature-line"></div>
        <div class="signature-date">Name: ___________________________</div>
        <div class="signature-date">Date: ____________________________</div>
      </div>
      <div class="signature-box">
        <div class="signature-label"><strong>Supervisor/Manager Approval</strong></div>
        <div class="signature-line"></div>
        <div class="signature-date">Name: ___________________________</div>
        <div class="signature-date">Date: ____________________________</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

function formatWorkType(type) {
  const types = {
    preventive: 'Preventive Maintenance',
    corrective: 'Corrective Maintenance',
    inspection: 'Inspection',
    emergency: 'Emergency Repair',
    installation: 'Installation',
    calibration: 'Calibration'
  };
  return types[type] || type;
}

module.exports = {
  generateWorkOrderPDF
};
