import ExcelJS from 'exceljs';

/**
 * Populates the purchase order Excel template with data
 * @param {Object} purchaseOrder - The purchase order data to populate
 * @returns {Blob} - Excel file as a blob
 */
export const generatePurchaseOrderExcel = async (purchaseOrder) => {
  console.log('Purchase order data received in Excel generator:', purchaseOrder);
  
  // Create a new workbook
  const workbook = new ExcelJS.Workbook();
  
  // Add a worksheet
  const worksheet = workbook.addWorksheet('Sheet1', {
    properties: {
      defaultColWidth: 12,
      defaultRowHeight: 20,
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true
      }
    }
  });
  
  // Define column widths
  worksheet.columns = [
    { header: '', key: 'a', width: 4 },    // A
    { header: '', key: 'b', width: 18 },   // B - Supplier Part # column
    { header: '', key: 'c', width: 18 },   // C - Fiserv Part # column
    { header: '', key: 'd', width: 30 },   // D - Description column
    { header: '', key: 'e', width: 4 },    // E - Spacer
    { header: '', key: 'f', width: 12 },   // F - Unit price column
    { header: '', key: 'g', width: 6 },    // G - Qty column
    { header: '', key: 'h', width: 12 },   // H - Total column
    { header: '', key: 'i', width: 4 },    // I - Spacer
    { header: '', key: 'j', width: 10 },   // J
    { header: '', key: 'k', width: 10 },   // K
    { header: '', key: 'l', width: 10 },   // L
    { header: '', key: 'm', width: 10 },   // M
    { header: '', key: 'n', width: 10 },   // N
    { header: '', key: 'o', width: 10 }    // O
  ];
  
  // Add rows for spacing at the top
  for (let i = 0; i < 6; i++) {
    worksheet.addRow(['']);
  }
  
  // Format date properly
  const formattedDate = purchaseOrder.created_at
    ? new Date(purchaseOrder.created_at).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
      }).replace(/\//g, '.')
    : '03.06.25';
  
  // Row 7: Title and date
  const row7 = worksheet.addRow(['', 'fiserv.', 'Maintenance', '', '', '', '', '', '', 'Request', '', formattedDate]);
  row7.getCell(2).font = {
    name: 'Arial',
    size: 18,
    color: { argb: 'FFFF6600' }, // Orange
    bold: true
  };
  row7.getCell(3).font = {
    name: 'Arial',
    size: 14,
    bold: true
  };
  row7.getCell(10).font = { bold: true };
  
  // Row 8: Supplier
  const row8 = worksheet.addRow(['', 'Supplier:', '', purchaseOrder.supplier_name || '', '', '', '', '', '', 'PO#', '', purchaseOrder.po_number || '']);
  row8.getCell(2).font = { bold: true };
  row8.getCell(2).alignment = { horizontal: 'right' };
  row8.getCell(10).font = { bold: true };
  row8.getCell(10).alignment = { horizontal: 'right' };
  
  // Row 9: NASHVILLE
  const row9 = worksheet.addRow(['', 'NASHVILLE', '', '', '', '', '', '', '', '']);
  row9.getCell(2).font = {
    name: 'Arial',
    size: 10,
    bold: true
  };
  
  // Extract machine information from notes if available
  let machineInfo = '';
  if (purchaseOrder.notes) {
    const machineMatch = purchaseOrder.notes.match(/Machine:?\s*([^,\n]+)/i);
    if (machineMatch && machineMatch[1]) {
      machineInfo = machineMatch[1].trim();
    }
  }
  
  // Determine if this is a "For Stock" purchase order
  const isForStock = purchaseOrder.notes && 
    purchaseOrder.notes.toLowerCase().includes('stock') ? 'Yes' : 'No';
  
  // Row 10: For Stock, Machine, Priority
  const row10 = worksheet.addRow(['', 'For Stock', isForStock, 'Machine', machineInfo || '', '', '', '', '', 'Priority', '', 'Urgent']);
  row10.getCell(2).font = { bold: true };
  row10.getCell(3).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' } // Yellow
  };
  row10.getCell(4).font = { bold: true };
  row10.getCell(10).font = { bold: true };
  row10.getCell(10).alignment = { horizontal: 'right' };
  row10.getCell(12).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' } // Yellow
  };
  
  // Add borders to header section
  for (let i = 7; i <= 10; i++) {
    const row = worksheet.getRow(i);
    for (let j = 2; j <= 12; j++) {
      const cell = row.getCell(j);
      if (cell.value !== undefined) {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
  }
  
  // Row 11: Table headers
  const row11 = worksheet.addRow(['', 'Supplier Part #', 'Fiserv Part #', 'Description', '', 'Unit price', 'Qty', 'Total']);
  row11.eachCell((cell, colNumber) => {
    if (colNumber >= 2 && colNumber <= 8) {
      cell.font = { bold: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD0D0D0' } // Light gray
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });
  
  // Add item rows
  let rowCount = 0;
  let totalSum = 0;
  
  // Enhanced debugging for items
  console.log('Purchase order items check:');
  console.log('- items property exists:', purchaseOrder.hasOwnProperty('items'));
  console.log('- items is array:', Array.isArray(purchaseOrder.items));
  console.log('- items length:', purchaseOrder.items ? purchaseOrder.items.length : 0);
  
  // Only use the actual purchase order items - no fallback to test data
  if (purchaseOrder.items && Array.isArray(purchaseOrder.items) && purchaseOrder.items.length > 0) {
    console.log('Processing actual purchase order items:', JSON.stringify(purchaseOrder.items, null, 2));
    
    purchaseOrder.items.forEach((item, index) => {
      rowCount++;
      
      // Enhanced debugging for each item
      console.log(`Processing item ${index + 1}:`, JSON.stringify(item, null, 2));
      
      // Safely extract values with fallbacks
      const unitPrice = typeof item.unit_price === 'number' ? item.unit_price : 
                       (parseFloat(item.unit_price) || 0);
      
      const quantity = typeof item.quantity === 'number' ? item.quantity : 
                      (parseInt(item.quantity) || 0);
      
      // Always calculate the total price based on unit price and quantity
      // Don't rely on potentially incorrect total_price from the database
      const totalPrice = unitPrice * quantity;
      
      console.log(`Item ${rowCount}: Unit Price: ${unitPrice}, Qty: ${quantity}, Total: ${totalPrice}`);
      
      totalSum += totalPrice;
      
      const itemRow = worksheet.addRow([
        '',
        item.manufacturer_part_number || '',
        item.fiserv_part_number || '',
        item.part_name || item.description || '',
        '',
        unitPrice,
        quantity,
        totalPrice
      ]);
      
      // Style all cells in the row
      itemRow.eachCell((cell, colNumber) => {
        if (colNumber >= 2 && colNumber <= 8) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Currency formatting for price columns
          if (colNumber === 6 || colNumber === 8) {
            cell.numFmt = '"$"#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
          
          // Right-align quantity
          if (colNumber === 7) {
            cell.alignment = { horizontal: 'right' };
          }
        }
      });
    });
  } else {
    console.warn('No purchase order items found, or format is unexpected');
  }
  
  // Add empty rows if there were no items, to maintain template layout
  if (rowCount === 0) {
    for (let i = 0; i < 5; i++) {
      const emptyRow = worksheet.addRow(['', '', '', '', '', '', '', '']);
      emptyRow.eachCell((cell, colNumber) => {
        if (colNumber >= 2 && colNumber <= 8) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      });
    }
  }
  
  // Add total row at the bottom
  const totalRow = worksheet.addRow(['', '', '', '', '', 'Total:', '', totalSum]);
  totalRow.getCell(6).font = { bold: true };
  totalRow.getCell(6).alignment = { horizontal: 'right' };
  totalRow.getCell(8).font = { bold: true };
  totalRow.getCell(8).numFmt = '"$"#,##0.00';
  totalRow.getCell(8).alignment = { horizontal: 'right' };
  totalRow.eachCell((cell, colNumber) => {
    if (colNumber >= 2 && colNumber <= 8) {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
  });
  
  // Add authorization section
  
  // Empty row for spacing
  worksheet.addRow(['']);
  
  // Authorization section
  const authRow1 = worksheet.addRow(['', 'Authorized by:', '']);
  authRow1.getCell(2).font = { bold: true };
  
  const authRow2 = worksheet.addRow(['', 'Name:', 'Date:']);
  authRow2.getCell(2).font = { bold: true };
  authRow2.getCell(3).font = { bold: true };
  
  // Empty signature line
  const signatureRow = worksheet.addRow(['', '_______________________', '_______________']);
  
  // Add additional supplier information section if available
  if (purchaseOrder.supplier_name || purchaseOrder.supplier_address || purchaseOrder.supplier_email || purchaseOrder.supplier_phone) {
    worksheet.addRow(['']);
    worksheet.addRow(['']);
    
    const supplierInfoTitle = worksheet.addRow(['', 'Supplier Information:', '']);
    supplierInfoTitle.getCell(2).font = { bold: true, size: 12 };
    
    if (purchaseOrder.supplier_name) {
      worksheet.addRow(['', 'Name:', purchaseOrder.supplier_name]);
    }
    
    if (purchaseOrder.supplier_address) {
      worksheet.addRow(['', 'Address:', purchaseOrder.supplier_address]);
    }
    
    if (purchaseOrder.supplier_email) {
      worksheet.addRow(['', 'Email:', purchaseOrder.supplier_email]);
    }
    
    if (purchaseOrder.supplier_phone) {
      worksheet.addRow(['', 'Phone:', purchaseOrder.supplier_phone]);
    }
    
    if (purchaseOrder.supplier_contact_name) {
      worksheet.addRow(['', 'Contact:', purchaseOrder.supplier_contact_name]);
    }
  }
  
  // Add footer with multi-supplier note
  worksheet.addRow(['']);
  const footerRow = worksheet.addRow(['', 'Note: This purchase order is for the specified supplier only. Other suppliers for these parts may be available.']);
  footerRow.getCell(2).font = { italic: true, color: { argb: 'FF808080' } };
  
  // Generate the Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  
  // Convert buffer to blob
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  return blob;
};
