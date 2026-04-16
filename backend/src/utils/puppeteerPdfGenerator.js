const puppeteer = require('puppeteer');

/**
 * Generate Analytics Report PDF using Puppeteer (Chrome rendering)
 * This creates a high-quality, pixel-perfect PDF from HTML/CSS
 */
async function generatePuppeteerAnalyticsPDF(analyticsData) {
  let browser;
  try {
    console.log('🚀 Launching Puppeteer browser...');
    
    // Launch headless Chrome
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ Browser launched successfully');

    console.log('📄 Creating new page...');
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });
    console.log('✅ Page created, viewport set');

    // Generate HTML content
    console.log('🎨 Generating HTML content...');
    const htmlContent = generateHTMLReport(analyticsData);
    console.log(`✅ HTML generated (${htmlContent.length} characters)`);

    // Load HTML into the page
    console.log('📥 Loading HTML into page...');
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    console.log('✅ HTML loaded successfully');

    // Generate PDF with options
    console.log('📄 Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `
        <div style="font-size: 9px; text-align: center; width: 100%; color: #666; padding: 10px;">
          <span class="pageNumber"></span> / <span class="totalPages"></span> | Inventory Management System - Confidential
        </div>
      `,
      timeout: 30000
    });
    
    console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);
    return pdfBuffer;
  } catch (error) {
    console.error('❌ Puppeteer PDF generation error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    throw new Error(`Puppeteer PDF generation failed: ${error.message}`);
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...');
      await browser.close();
      console.log('✅ Browser closed');
    }
  }
}

/**
 * Generate beautiful HTML report with modern styling
 */
function generateHTMLReport(data) {
  const { inventoryHealth, usagePatterns, costAnalysis } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
    }

    .page {
      page-break-after: always;
      padding: 40px;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Header Styles */
    .header {
      background: linear-gradient(135deg, #0066A1 0%, #004d7a 100%);
      color: white;
      padding: 40px;
      margin: -40px -40px 40px -40px;
      border-radius: 0 0 20px 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .header h1 {
      font-size: 42px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -0.5px;
    }

    .header .subtitle {
      font-size: 18px;
      opacity: 0.95;
      font-weight: 400;
    }

    .header .date {
      margin-top: 15px;
      font-size: 14px;
      opacity: 0.85;
    }

    /* Section Headers */
    .section-header {
      color: #0066A1;
      font-size: 28px;
      font-weight: 700;
      margin: 30px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 4px solid #FF6600;
    }

    /* Executive Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }

    .summary-card {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 2px solid #dee2e6;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }

    .summary-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }

    .summary-card .icon {
      font-size: 40px;
      margin-bottom: 10px;
      display: block;
    }

    .summary-card .value {
      font-size: 36px;
      font-weight: 700;
      color: #0066A1;
      margin: 10px 0;
    }

    .summary-card .label {
      font-size: 14px;
      color: #6c757d;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .summary-card.danger .value {
      color: #dc3545;
    }

    .summary-card.success .value {
      color: #28a745;
    }

    /* Insights Box */
    .insights-box {
      background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
      border-left: 5px solid #FF6600;
      padding: 20px 25px;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .insights-box h3 {
      color: #0066A1;
      margin-bottom: 15px;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .insights-box ul {
      list-style: none;
      padding: 0;
    }

    .insights-box li {
      padding: 8px 0;
      padding-left: 25px;
      position: relative;
      font-size: 14px;
      color: #495057;
    }

    .insights-box li:before {
      content: "→";
      position: absolute;
      left: 0;
      color: #FF6600;
      font-weight: bold;
    }

    /* Tables */
    .table-container {
      margin: 20px 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    thead {
      background: linear-gradient(135deg, #0066A1 0%, #004d7a 100%);
      color: white;
    }

    thead th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    tbody tr {
      border-bottom: 1px solid #e9ecef;
      transition: background-color 0.2s;
    }

    tbody tr:nth-child(even) {
      background-color: #f8f9fa;
    }

    tbody tr:hover {
      background-color: #e3f2fd;
    }

    tbody td {
      padding: 12px 15px;
      font-size: 13px;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-danger {
      background: #dc3545;
      color: white;
    }

    .badge-warning {
      background: #ffc107;
      color: #1a1a1a;
    }

    .badge-success {
      background: #28a745;
      color: white;
    }

    .badge-info {
      background: #17a2b8;
      color: white;
    }

    /* Trend Indicators */
    .trend {
      font-weight: 600;
    }

    .trend-up {
      color: #28a745;
    }

    .trend-down {
      color: #dc3545;
    }

    .trend-neutral {
      color: #6c757d;
    }

    /* Risk Indicator */
    .risk-score {
      font-weight: 700;
    }

    .risk-critical {
      color: #dc3545;
    }

    .risk-high {
      color: #fd7e14;
    }

    .risk-medium {
      color: #ffc107;
    }

    /* Chart Placeholder */
    .chart-placeholder {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border: 2px dashed #dee2e6;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      color: #6c757d;
      margin: 20px 0;
    }

    /* Financial Boxes */
    .financial-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 20px 0;
    }

    .financial-box {
      background: white;
      border: 2px solid #dee2e6;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .financial-box .amount {
      font-size: 28px;
      font-weight: 700;
      color: #0066A1;
      margin: 10px 0;
    }

    .financial-box .description {
      font-size: 12px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>

  <!-- PAGE 1: Executive Summary -->
  <div class="page">
    <div class="header">
      <h1>📊 IMMS Analytics Report</h1>
      <div class="subtitle">Inventory Management Dashboard</div>
      <div class="date">Generated: ${new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</div>
    </div>

    <h2 class="section-header">Executive Summary</h2>
    
    <div class="summary-grid">
      <div class="summary-card">
        <span class="icon">📊</span>
        <div class="value">${inventoryHealth.average_turnover_rate}</div>
        <div class="label">Inventory Turnover Rate</div>
      </div>
      
      <div class="summary-card">
        <span class="icon">📅</span>
        <div class="value">${inventoryHealth.stock_coverage_days}</div>
        <div class="label">Stock Coverage (Days)</div>
      </div>
      
      <div class="summary-card danger">
        <span class="icon">⚠️</span>
        <div class="value">${inventoryHealth.high_risk_parts.length}</div>
        <div class="label">High Risk Parts</div>
      </div>
      
      <div class="summary-card success">
        <span class="icon">💰</span>
        <div class="value">$${parseFloat(costAnalysis.total_inventory_value).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
        <div class="label">Total Inventory Value</div>
      </div>
    </div>

    <h2 class="section-header">Inventory Health Analysis</h2>

    <div class="insights-box">
      <h3>📌 Key Insights</h3>
      <ul>
        <li>Average inventory turnover rate is <strong>${inventoryHealth.average_turnover_rate}x</strong></li>
        <li>Stock coverage is sufficient for <strong>${inventoryHealth.stock_coverage_days} days</strong> of operation</li>
        <li><strong>${inventoryHealth.high_risk_parts.length} parts</strong> require immediate attention</li>
        <li>Total active parts in inventory: <strong>${costAnalysis.total_parts || 0}</strong></li>
      </ul>
    </div>

    ${inventoryHealth.high_risk_parts.length > 0 ? `
    <h3 style="color: #dc3545; margin: 25px 0 15px 0; font-size: 20px;">🚨 High Risk Parts - Immediate Action Required</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Part Name</th>
            <th class="text-center">Risk Score</th>
            <th class="text-center">Days Until Stockout</th>
            <th class="text-center">Current Qty</th>
            <th class="text-center">Action Required</th>
          </tr>
        </thead>
        <tbody>
          ${inventoryHealth.high_risk_parts.slice(0, 10).map(part => {
            const riskPercent = (part.risk_score * 100).toFixed(0);
            const riskClass = part.risk_score >= 0.9 ? 'risk-critical' : part.risk_score >= 0.7 ? 'risk-high' : 'risk-medium';
            const actionBadge = part.risk_score >= 0.9 ? 'badge-danger' : part.risk_score >= 0.7 ? 'badge-warning' : 'badge-info';
            const actionText = part.risk_score >= 0.9 ? 'URGENT' : part.risk_score >= 0.7 ? 'HIGH' : 'MONITOR';
            
            return `
            <tr>
              <td><strong>${part.name}</strong></td>
              <td class="text-center"><span class="risk-score ${riskClass}">${riskPercent}%</span></td>
              <td class="text-center">${part.days_until_stockout.toFixed(1)}</td>
              <td class="text-center">${part.current_quantity || 0}</td>
              <td class="text-center"><span class="badge ${actionBadge}">${actionText}</span></td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  </div>

  <!-- PAGE 2: Usage Patterns -->
  <div class="page">
    <h2 class="section-header">Usage Pattern Analysis</h2>

    <h3 style="color: #0066A1; margin: 25px 0 15px 0; font-size: 20px;">📈 Fastest Moving Parts (Last 30 Days)</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Part Name</th>
            <th class="text-center">Trend</th>
            <th class="text-center">30-Day Usage</th>
            <th class="text-center">Weekly Average</th>
          </tr>
        </thead>
        <tbody>
          ${usagePatterns.fastest_moving_parts.map(part => {
            const trendSymbol = part.trend > 0 ? '↗' : part.trend < 0 ? '↘' : '→';
            const trendClass = part.trend > 0 ? 'trend-up' : part.trend < 0 ? 'trend-down' : 'trend-neutral';
            
            return `
            <tr>
              <td><strong>${part.name}</strong></td>
              <td class="text-center"><span class="trend ${trendClass}">${trendSymbol} ${part.trend.toFixed(1)}%</span></td>
              <td class="text-center">${part.usage_last_30_days}</td>
              <td class="text-center">${(part.avg_weekly_usage || 0).toFixed(1)}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    ${usagePatterns.high_velocity_parts && usagePatterns.high_velocity_parts.length > 0 ? `
    <h3 style="color: #0066A1; margin: 35px 0 15px 0; font-size: 20px;">⚡ High Velocity Parts - Most Frequently Used</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Part Name</th>
            <th class="text-center">Usage Frequency</th>
            <th class="text-center">Total Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${usagePatterns.high_velocity_parts.map(part => `
            <tr>
              <td><strong>${part.name}</strong></td>
              <td class="text-center"><span class="badge badge-info">${part.usage_frequency} times</span></td>
              <td class="text-center">${part.total_quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
  </div>

  <!-- PAGE 3: Cost Analysis -->
  <div class="page">
    <h2 class="section-header">Cost Analysis & Financial Overview</h2>

    <div class="financial-grid">
      <div class="financial-box">
        <div class="amount">$${parseFloat(costAnalysis.total_inventory_value).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
        <div class="description">Total Inventory Value</div>
      </div>
      
      <div class="financial-box">
        <div class="amount">$${parseFloat(costAnalysis.average_part_cost).toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
        <div class="description">Average Part Cost</div>
      </div>
      
      <div class="financial-box">
        <div class="amount">${costAnalysis.total_parts || 0}</div>
        <div class="description">Active Parts</div>
      </div>
    </div>

    <h3 style="color: #0066A1; margin: 35px 0 15px 0; font-size: 20px;">💎 Highest Value Parts</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Part Name</th>
            <th class="text-right">Total Value</th>
            <th class="text-center">Quantity</th>
            <th class="text-right">Unit Cost</th>
          </tr>
        </thead>
        <tbody>
          ${costAnalysis.highest_value_parts.slice(0, 12).map(part => `
            <tr>
              <td><strong>${part.name}</strong></td>
              <td class="text-right">$${parseFloat(part.total_value).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
              <td class="text-center">${part.quantity}</td>
              <td class="text-right">$${parseFloat(part.unit_cost).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

</body>
</html>
  `;
}

module.exports = {
  generatePuppeteerAnalyticsPDF
};

