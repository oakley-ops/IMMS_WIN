/**
 * Purchase Order PDF Parser
 * Extracts structured data from purchase order PDFs
 */

/**
 * Extract PO number from PDF text
 * Pattern: "PO NUMBER" followed by number
 */
function extractPONumber(text) {
  const patterns = [
    /PO\s+NUMBER\s+(\d+)/i,
    /PO\s*#\s*(\d+)/i,
    /Purchase\s+Order\s*#?\s*(\d+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract PO date from PDF text
 * Pattern: Date in MM/DD/YY or MM/DD/YYYY format
 */
function extractPODate(text) {
  const patterns = [
    /PO\s+DATE\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract vendor information from PDF text
 */
function extractVendor(text) {
  const vendorSection = text.match(/VENDOR\s+([\s\S]*?)(?=SHIP TO|TERMS|$)/i);
  
  if (!vendorSection) {
    return null;
  }
  
  const lines = vendorSection[1].split('\n').filter(line => line.trim());
  
  return {
    name: lines[0]?.trim() || '',
    address: lines.slice(1).join(', ').trim() || ''
  };
}

/**
 * Extract ship to information from PDF text
 */
function extractShipTo(text) {
  const shipToSection = text.match(/SHIP TO\s+([\s\S]*?)(?=Phone|Fax|QUANTITY|$)/i);
  
  if (!shipToSection) {
    return null;
  }
  
  const lines = shipToSection[1].split('\n').filter(line => line.trim());
  
  // Extract phone if present
  const phoneMatch = text.match(/Phone:\s*([\d-]+)/i);
  const faxMatch = text.match(/Fax:\s*([\d-]+)/i);
  
  return {
    name: lines[0]?.trim() || '',
    address: lines.slice(1).join(', ').trim() || '',
    phone: phoneMatch ? phoneMatch[1] : '',
    fax: faxMatch ? faxMatch[1] : ''
  };
}

/**
 * Extract buyer name from PDF text
 */
function extractBuyer(text) {
  const buyerMatch = text.match(/BUYER:\s*([^\n]+)/i);
  return buyerMatch ? buyerMatch[1].trim() : null;
}

/**
 * Extract authorized by from PDF text
 */
function extractAuthorizedBy(text) {
  const authMatch = text.match(/AUTHORIZED BY:\s*([^\n]+)/i);
  return authMatch ? authMatch[1].trim() : null;
}

/**
 * Extract line items from PDF text
 * This is the most complex part as it needs to parse table structure
 */
function extractLineItems(text) {
  const items = [];
  
  // Look for the table section starting with QUANTITY ORDERED
  const tableMatch = text.match(/QUANTITY\s+ORDERED[\s\S]*?(?=COMMENTS|TAX|TOTAL|$)/i);
  
  if (!tableMatch) {
    console.warn('Could not find line items table in PDF');
    return items;
  }
  
  const tableText = tableMatch[0];
  const lines = tableText.split('\n').filter(line => line.trim());
  
  // Skip header rows
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/QUANTITY|ORDER UNIT|DESCRIPTION|PRICE/i)) {
      startIndex = i + 1;
      break;
    }
  }
  
  // Parse each line item
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Try to match line item pattern
    // Expected format: QUANTITY  UNIT  DESCRIPTION  JOB_NUMBER  UNIT_PRICE  PRICING_UNIT  EXTENDED_PRICE
    // Example: "275     EA    Vendor Item # NS Glycol Super cool 30%    000000    6.84    EA    1881.00"
    
    const itemMatch = line.match(/^(\d+)\s+([A-Z]+)\s+(.*?)\s+(\d+)\s+([\d,.]+)\s+([A-Z]+)\s+([\d,.]+)$/i);
    
    if (itemMatch) {
      const [, quantity, unit, description, jobNumber, unitPrice, pricingUnit, extendedPrice] = itemMatch;
      
      items.push({
        quantity: parseInt(quantity, 10),
        unit: unit.trim(),
        description: description.trim(),
        jobNumber: jobNumber.trim(),
        unitPrice: parseFloat(unitPrice.replace(/,/g, '')),
        pricingUnit: pricingUnit.trim(),
        extendedPrice: parseFloat(extendedPrice.replace(/,/g, ''))
      });
    } else {
      // Try simpler pattern without job number
      const simpleMatch = line.match(/^(\d+)\s+([A-Z]+)\s+(.*?)\s+([\d,.]+)\s+([A-Z]+)\s+([\d,.]+)$/i);
      
      if (simpleMatch) {
        const [, quantity, unit, description, unitPrice, pricingUnit, extendedPrice] = simpleMatch;
        
        items.push({
          quantity: parseInt(quantity, 10),
          unit: unit.trim(),
          description: description.trim(),
          jobNumber: null,
          unitPrice: parseFloat(unitPrice.replace(/,/g, '')),
          pricingUnit: pricingUnit.trim(),
          extendedPrice: parseFloat(extendedPrice.replace(/,/g, ''))
        });
      }
    }
  }
  
  return items;
}

/**
 * Extract tax amount from PDF text
 */
function extractTax(text) {
  const taxMatch = text.match(/TAX\s+([\d,.]+)/i);
  return taxMatch ? parseFloat(taxMatch[1].replace(/,/g, '')) : 0;
}

/**
 * Extract total amount from PDF text
 */
function extractTotal(text) {
  const totalMatch = text.match(/TOTAL\s+([\d,.]+)/i);
  return totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;
}

/**
 * Extract comments/notes from PDF text
 */
function extractComments(text) {
  const commentsMatch = text.match(/COMMENTS\s+([\s\S]*?)(?=ORIGINAL|TAX|BUYER|$)/i);
  return commentsMatch ? commentsMatch[1].trim() : null;
}

/**
 * Main parser function - extracts all data from Purchase Order PDF
 * @param {string} pdfText - Raw text extracted from PDF
 * @returns {Object} Parsed purchase order data
 */
function parsePurchaseOrderPDF(pdfText) {
  console.log('Parsing Purchase Order PDF...');
  console.log('=== PDF TEXT START ===');
  console.log(pdfText);
  console.log('=== PDF TEXT END ===');
  console.log('PDF text length:', pdfText.length);
  
  const parsed = {
    poNumber: extractPONumber(pdfText),
    poDate: extractPODate(pdfText),
    vendor: extractVendor(pdfText),
    shipTo: extractShipTo(pdfText),
    buyer: extractBuyer(pdfText),
    authorizedBy: extractAuthorizedBy(pdfText),
    lineItems: extractLineItems(pdfText),
    tax: extractTax(pdfText),
    total: extractTotal(pdfText),
    comments: extractComments(pdfText)
  };
  
  console.log('Parsed PO data:', {
    poNumber: parsed.poNumber,
    vendor: parsed.vendor?.name,
    itemCount: parsed.lineItems.length,
    total: parsed.total
  });
  
  return parsed;
}

module.exports = {
  parsePurchaseOrderPDF,
  extractPONumber,
  extractPODate,
  extractVendor,
  extractShipTo,
  extractBuyer,
  extractLineItems,
  extractTax,
  extractTotal
};
