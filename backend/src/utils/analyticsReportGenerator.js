const PDFDocument = require('pdfkit');

/**
 * Generate Analytics Report PDF - Professional ReportLab-Style Layout
 * High-quality design with clean formatting, proper spacing, and visual hierarchy
 */
async function generateAnalyticsReportPDF(analyticsData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'LETTER', 
        margins: { top: 50, bottom: 60, left: 60, right: 60 },
        bufferPages: true
      });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Professional Color Scheme (ReportLab Style)
      const colors = {
        primary: '#0066A1',
        accent: '#FF6600',
        text: '#1a1a1a',
        textSecondary: '#4a4a4a',
        border: '#CCCCCC',
        tableBg: '#F8F9FA',
        tableAlt: '#FFFFFF',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545'
      };

      const pageWidth = doc.page.width;
      const leftMargin = doc.page.margins.left;
      const rightMargin = doc.page.margins.right;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      // ========================================
      // COVER PAGE / HEADER
      // ========================================
      
      // Blue header bar
      doc.rect(0, 0, pageWidth, 120)
         .fill(colors.primary);

      // White company name
      doc.fillColor('#FFFFFF')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('IMMS', leftMargin, 30);

      // Report title
      doc.fontSize(32)
         .text('Analytics Dashboard Report', leftMargin, 65);

      // Date and time in header
      doc.fontSize(11)
         .font('Helvetica')
         .text(`Generated: ${new Date().toLocaleString('en-US', {
           weekday: 'long',
           year: 'numeric',
           month: 'long',
           day: 'numeric',
           hour: '2-digit',
           minute: '2-digit'
         })}`, leftMargin, 98);

      // Reset position after header
      doc.y = 150;

      // ========================================
      // EXECUTIVE SUMMARY SECTION
      // ========================================
      
      addSectionHeader(doc, 'Executive Summary', colors, leftMargin, contentWidth);
      
      const summaryData = [
        { 
          label: 'Inventory Turnover', 
          value: analyticsData.inventoryHealth.average_turnover_rate,
          icon: '📊',
          color: colors.primary
        },
        { 
          label: 'Stock Coverage', 
          value: `${analyticsData.inventoryHealth.stock_coverage_days} days`,
          icon: '📅',
          color: colors.primary
        },
        { 
          label: 'High Risk Parts', 
          value: analyticsData.inventoryHealth.high_risk_parts.length,
          icon: '⚠️',
          color: colors.danger
        },
        { 
          label: 'Total Inventory Value', 
          value: `$${parseFloat(analyticsData.costAnalysis.total_inventory_value).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          icon: '💰',
          color: colors.success
        }
      ];

      // Summary boxes in 2x2 grid
      const boxWidth = (contentWidth - 30) / 2;
      const boxHeight = 90;
      let boxX = leftMargin;
      let boxY = doc.y;

      summaryData.forEach((item, index) => {
        if (index === 2) {
          // Move to second row
          boxX = leftMargin;
          boxY += boxHeight + 15;
        }

        // Box shadow effect
        doc.rect(boxX + 2, boxY + 2, boxWidth, boxHeight)
           .fill('#E0E0E0');

        // Main box
        doc.rect(boxX, boxY, boxWidth, boxHeight)
           .fillAndStroke('#FFFFFF', colors.border);

        // Icon
        doc.fontSize(24)
           .text(item.icon, boxX + 15, boxY + 15);

        // Value
        doc.fillColor(item.color)
           .fontSize(26)
           .font('Helvetica-Bold')
           .text(item.value, boxX + 60, boxY + 20, { width: boxWidth - 80, align: 'left' });

        // Label
        doc.fillColor(colors.textSecondary)
           .fontSize(11)
           .font('Helvetica')
           .text(item.label, boxX + 60, boxY + 52);

        boxX += boxWidth + 15;
      });

      doc.y = boxY + boxHeight + 30;

      // ========================================
      // PAGE 1: INVENTORY HEALTH
      // ========================================
      
      doc.addPage();
      addSectionHeader(doc, 'Inventory Health Analysis', colors, leftMargin, contentWidth);

      // Key Insights Box
      const insightY = doc.y;
      doc.roundedRect(leftMargin, insightY, contentWidth, 80, 5)
         .fillAndStroke(colors.tableBg, colors.border);

      doc.fillColor(colors.text)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('📌 Key Insights', leftMargin + 20, insightY + 15);

      doc.font('Helvetica')
         .fontSize(10)
         .fillColor(colors.textSecondary)
         .text(`• Average inventory turnover rate is ${analyticsData.inventoryHealth.average_turnover_rate}x`, 
                leftMargin + 20, insightY + 35)
         .text(`• Stock coverage is sufficient for ${analyticsData.inventoryHealth.stock_coverage_days} days of operation`, 
                leftMargin + 20, insightY + 50)
         .text(`• ${analyticsData.inventoryHealth.high_risk_parts.length} parts require immediate attention`, 
                leftMargin + 20, insightY + 65);

      doc.y = insightY + 95;

      // High Risk Parts Table
      if (analyticsData.inventoryHealth.high_risk_parts.length > 0) {
        doc.fillColor(colors.text)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('High Risk Parts - Requiring Immediate Action', leftMargin, doc.y);

        doc.moveDown(0.8);

        // Professional table
        drawProfessionalTable(doc, {
          headers: ['Part Name', 'Risk', 'Days Left', 'Qty', 'Action'],
          columnWidths: [200, 60, 70, 50, 115],
          rows: analyticsData.inventoryHealth.high_risk_parts.slice(0, 12).map(part => [
            truncateText(part.name, 30),
            `${(part.risk_score * 100).toFixed(0)}%`,
            part.days_until_stockout.toFixed(1),
            part.current_quantity || 0,
            part.risk_score >= 0.9 ? 'URGENT' : part.risk_score >= 0.7 ? 'High' : 'Monitor'
          ]),
          colors,
          startX: leftMargin,
          startY: doc.y
        }, part => {
          const risk = parseFloat(part[1]);
          return risk >= 90 ? colors.danger : risk >= 70 ? colors.warning : colors.textSecondary;
        });
      }

      // ========================================
      // PAGE 2: USAGE PATTERNS
      // ========================================
      
      doc.addPage();
      addSectionHeader(doc, 'Usage Pattern Analysis', colors, leftMargin, contentWidth);

      // Fastest Moving Parts
      doc.fillColor(colors.text)
         .fontSize(13)
         .font('Helvetica-Bold')
         .text('Fastest Moving Parts (Last 30 Days)', leftMargin, doc.y);

      doc.moveDown(0.8);

      drawProfessionalTable(doc, {
        headers: ['Part Name', 'Trend', '30-Day Usage', 'Weekly Avg'],
        columnWidths: [220, 80, 100, 95],
        rows: analyticsData.usagePatterns.fastest_moving_parts.map(part => [
          truncateText(part.name, 35),
          formatTrend(part.trend),
          part.usage_last_30_days,
          (part.avg_weekly_usage || 0).toFixed(1)
        ]),
        colors,
        startX: leftMargin,
        startY: doc.y
      });

      // High Velocity Parts
      if (analyticsData.usagePatterns.high_velocity_parts && analyticsData.usagePatterns.high_velocity_parts.length > 0) {
        doc.moveDown(2);
        
        doc.fillColor(colors.text)
           .fontSize(13)
           .font('Helvetica-Bold')
           .text('High Velocity Parts - Most Frequently Used', leftMargin, doc.y);

        doc.moveDown(0.8);

        drawProfessionalTable(doc, {
          headers: ['Part Name', 'Usage Frequency', 'Total Quantity'],
          columnWidths: [260, 120, 115],
          rows: analyticsData.usagePatterns.high_velocity_parts.map(part => [
            truncateText(part.name, 40),
            `${part.usage_frequency} times`,
            part.total_quantity
          ]),
          colors,
          startX: leftMargin,
          startY: doc.y
        });
      }

      // ========================================
      // PAGE 3: COST ANALYSIS
      // ========================================
      
      doc.addPage();
      addSectionHeader(doc, 'Cost Analysis & Financial Overview', colors, leftMargin, contentWidth);

      // Financial summary boxes
      const finBoxY = doc.y;
      const finBoxWidth = (contentWidth - 20) / 3;
      
      const financialMetrics = [
        {
          label: 'Total Inventory Value',
          value: `$${parseFloat(analyticsData.costAnalysis.total_inventory_value).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          color: colors.primary
        },
        {
          label: 'Average Part Cost',
          value: `$${parseFloat(analyticsData.costAnalysis.average_part_cost).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          color: colors.accent
        },
        {
          label: 'Active Parts',
          value: analyticsData.costAnalysis.total_parts || 0,
          color: colors.success
        }
      ];

      financialMetrics.forEach((metric, index) => {
        const x = leftMargin + (index * (finBoxWidth + 10));
        
        doc.rect(x, finBoxY, finBoxWidth, 70)
           .fillAndStroke('#FFFFFF', colors.border);

        doc.fillColor(metric.color)
           .fontSize(22)
           .font('Helvetica-Bold')
           .text(metric.value, x, finBoxY + 15, { width: finBoxWidth, align: 'center' });

        doc.fillColor(colors.textSecondary)
           .fontSize(9)
           .font('Helvetica')
           .text(metric.label, x, finBoxY + 48, { width: finBoxWidth, align: 'center' });
      });

      doc.y = finBoxY + 90;

      // Highest Value Parts Table
      doc.fillColor(colors.text)
         .fontSize(13)
         .font('Helvetica-Bold')
         .text('Highest Value Parts', leftMargin, doc.y);

      doc.moveDown(0.8);

      drawProfessionalTable(doc, {
        headers: ['Part Name', 'Total Value', 'Qty', 'Unit Cost'],
        columnWidths: [240, 90, 70, 95],
        rows: analyticsData.costAnalysis.highest_value_parts.slice(0, 12).map(part => [
          truncateText(part.name, 35),
          `$${parseFloat(part.total_value).toLocaleString('en-US', {minimumFractionDigits: 2})}`,
          part.quantity,
          `$${parseFloat(part.unit_cost).toFixed(2)}`
        ]),
        colors,
        startX: leftMargin,
        startY: doc.y
      });

      // ========================================
      // ADD PAGE NUMBERS AND FOOTERS
      // ========================================
      
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        // Footer line
        doc.moveTo(leftMargin, doc.page.height - 45)
           .lineTo(pageWidth - rightMargin, doc.page.height - 45)
           .lineWidth(0.5)
           .stroke(colors.border);

        // Page number and info
        doc.fontSize(8)
           .fillColor(colors.textSecondary)
           .font('Helvetica')
           .text(
             `Page ${i + 1} of ${pageCount}`,
             leftMargin,
             doc.page.height - 35,
             { align: 'left' }
           );

        doc.text(
          'Inventory Management System - Confidential',
          0,
          doc.page.height - 35,
          { align: 'center', width: pageWidth }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Draw professional section header with underline
 */
function addSectionHeader(doc, title, colors, x, width) {
  const y = doc.y;
  
  doc.fillColor(colors.primary)
     .fontSize(18)
     .font('Helvetica-Bold')
     .text(title, x, y);

  doc.moveDown(0.4);
  
  // Thick colored line
  doc.moveTo(x, doc.y)
     .lineTo(x + width, doc.y)
     .lineWidth(3)
     .stroke(colors.accent);

  doc.moveDown(1.2);
}

/**
 * Draw a professional ReportLab-style table
 */
function drawProfessionalTable(doc, config, rowColorFunc) {
  const { headers, columnWidths, rows, colors, startX, startY } = config;
  let y = startY;

  // Calculate total width
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);

  // Table Header Background
  doc.rect(startX, y, totalWidth, 25)
     .fill(colors.primary);

  // Table Headers
  doc.fillColor('#FFFFFF')
     .fontSize(10)
     .font('Helvetica-Bold');

  let x = startX;
  headers.forEach((header, i) => {
    doc.text(header, x + 8, y + 8, { 
      width: columnWidths[i] - 16, 
      align: i === 0 ? 'left' : 'center'
    });
    x += columnWidths[i];
  });

  y += 25;

  // Table Rows
  doc.font('Helvetica').fontSize(9);
  
  rows.forEach((row, rowIndex) => {
    const rowHeight = 22;
    
    // Alternating row colors
    const bgColor = rowIndex % 2 === 0 ? colors.tableAlt : colors.tableBg;
    doc.rect(startX, y, totalWidth, rowHeight)
       .fill(bgColor);

    // Row border
    doc.rect(startX, y, totalWidth, rowHeight)
       .stroke(colors.border);

    // Cell content
    x = startX;
    row.forEach((cell, colIndex) => {
      // Special color for certain columns
      let textColor = colors.text;
      if (rowColorFunc) {
        textColor = rowColorFunc(row);
      }

      doc.fillColor(textColor)
         .text(cell, x + 8, y + 6, { 
           width: columnWidths[colIndex] - 16, 
           align: colIndex === 0 ? 'left' : 'center',
           baseline: 'middle'
         });
      x += columnWidths[colIndex];
    });

    y += rowHeight;
  });

  doc.y = y + 10;
}

/**
 * Helper: Truncate text
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

/**
 * Helper: Format trend with arrow
 */
function formatTrend(trend) {
  const symbol = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
  return `${symbol} ${trend.toFixed(1)}%`;
}

module.exports = {
  generateAnalyticsReportPDF
};
