/**
 * Purchase Order PDF Generator
 * Generates printable purchase order PDFs with a clean, professional layout
 */
import html2pdf from 'html2pdf.js';

/**
 * Main function to generate a purchase order PDF
 * @param {Object} purchaseOrder - The purchase order data
 * @param {boolean} returnBlob - If true, returns a PDF blob instead of opening a new window
 * @returns {Promise<Blob|void>} - Resolves when PDF is generated or returns a PDF blob
 */
export const generatePurchaseOrderPDF = async (purchaseOrder, returnBlob = false) => {
  try {
    // Always show the "IMMS" text logo
    const isDemo = process.env.REACT_APP_DEMO_MODE === 'true';
    // Format dates
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    // Format currency
    const formatCurrency = (amount) => {
      if (amount === null || amount === undefined) return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    };

    // Get line items
    const lineItems = purchaseOrder.items || [];
    
    // Log detailed information about each line item for debugging
    console.log('Processing line items for PDF export:');
    lineItems.forEach((item, index) => {
      // Extract part name using multiple fallbacks
      const partName = item.custom_part_name || 
                      item.part_name || 
                      item.name || 
                      item.partName || 
                      item.PartName || 
                      item.part_description;
                      
      // Extract part number using multiple fallbacks (prioritizing manufacturer part number)
      const partNumber = item.manufacturer_part_number || 
                         item.custom_part_number || 
                         item.internal_part_number || 
                         item.part_number || 
                         item.partNumber || 
                         item.PartNumber || 
                         item.part_num || 
                         item.part_id;
                         
      // Try to extract data from notes if available
      let notesData = {};
      if (item.notes) {
        try {
          notesData = JSON.parse(item.notes);
        } catch (e) {
          console.log('Failed to parse notes JSON:', e);
        }
      }
      
      // Log the extracted data
      console.log(`Item ${index + 1} details:`, {
        itemId: item.item_id,
        partId: item.part_id,
        partName: partName || (notesData.part_name || notesData.custom_part_name || 'No Name'),
        partNumber: partNumber || (notesData.part_number || notesData.custom_part_number || '-'),
        quantity: item.quantity,
        unitPrice: item.price || item.unit_price || item.unitPrice,
        totalPrice: (item.price || item.unit_price || item.unitPrice || 0) * (item.quantity || 0)
      });
      
      // Update the item with properly extracted fields to ensure PDF display
      item.display_part_name = partName || (notesData.part_name || notesData.custom_part_name || 'No Name');
      item.display_part_number = partNumber || (notesData.manufacturer_part_number || notesData.part_number || notesData.custom_part_number || '-');
    });
    
    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => {
      const price = parseFloat(item.price || item.unit_price || 0);
      const quantity = parseInt(item.quantity || 0);
      return sum + (price * quantity);
    }, 0);
    
    const shippingCost = parseFloat(purchaseOrder.shipping_cost || purchaseOrder.shippingCost || 0);
    const taxAmount = parseFloat(purchaseOrder.tax_amount || purchaseOrder.taxAmount || 0);
    const totalAmount = subtotal + shippingCost + taxAmount;

    // Log the purchase order data for debugging
    console.log('Purchase Order Data:', JSON.stringify(purchaseOrder, null, 2));
    console.log('Line Items:', JSON.stringify(lineItems, null, 2));
    console.log('Calculated Totals:', { subtotal, shippingCost, taxAmount, totalAmount });

    // app orange color
    const immsOrange = '#FF6200';

    // Generate HTML content for the PDF
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Order #${purchaseOrder.poNumber || purchaseOrder.po_number || ''}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            font-size: 12px;
          }
          .container {
            max-width: 750px;
            margin: 40px auto 0;
            padding: 0 15px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
            position: relative;
          }
          .logo {
            max-width: 80px;
            height: auto;
          }
          .logo-text {
            font-size: 24px;
            font-weight: bold;
            color: ${immsOrange};
            letter-spacing: 1px;
          }
          .header-title {
            color: ${immsOrange};
            font-size: 16px;
            font-weight: bold;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            top: 0;
          }
          .header-border {
            border-bottom: 2px solid ${immsOrange};
            margin-top: 0px;
            width: 100%;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
          }
          .info-left, .info-right {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 2px 5px;
            align-content: start;
          }
          .label {
            font-weight: bold;
            color: #555;
          }
          .value {
            color: #333;
          }
          .section-title {
            font-weight: bold;
            color: ${immsOrange};
            margin-bottom: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 6px;
            text-align: left;
          }
          th {
            background-color: ${immsOrange};
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .totals {
            width: 250px;
            margin-left: auto;
            border-collapse: collapse;
          }
          .totals td {
            padding: 3px;
            text-align: right;
          }
          .totals .total-label {
            font-weight: bold;
            width: 120px;
          }
          .grand-total {
            font-weight: bold;
            border-top: 1px solid ${immsOrange};
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #555;
          }
          .print-button {
            background-color: ${immsOrange};
            color: white;
            border: none;
            padding: 8px 15px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 4px;
            margin: 15px auto;
            display: block;
          }
          .print-button:hover {
            background-color: #E55A00;
          }
          @page {
            margin: 20px 0 0 0;
            size: auto;
          }
          @media print {
            .print-button {
              display: none;
            }
            body {
              padding: 0;
              margin: 0;
            }
            .container {
              border: none;
              margin-top: 40px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-text">IMMS</div>
            <div class="header-title">PURCHASE ORDER REQUEST</div>
          </div>
          <div class="header-border"></div>
          
          <div class="info-grid">
            <div class="info-left">
              <div class="label">Supplier:</div>
              <div class="value">${purchaseOrder.supplier?.name || purchaseOrder.supplier_name || ''}</div>
              
              <div class="label">Contact:</div>
              <div class="value">${purchaseOrder.supplier?.contactName || purchaseOrder.contact_name || ''}</div>
              
              <div class="label">Address:</div>
              <div class="value">${purchaseOrder.supplier?.address || purchaseOrder.supplier_address || ''}</div>
              
              <div class="label">Email:</div>
              <div class="value">${purchaseOrder.supplier?.email || purchaseOrder.supplier_email || ''}</div>
              
              <div class="label">Phone:</div>
              <div class="value">${purchaseOrder.supplier?.phone || purchaseOrder.supplier_phone || ''}</div>
            </div>
            
            <div class="info-right">
              <div class="label">PO Number:</div>
              <div class="value">${purchaseOrder.poNumber || purchaseOrder.po_number || ''}</div>
              
              <div class="label">Requested By:</div>
              <div class="value">${purchaseOrder.requestedBy || purchaseOrder.requested_by || ''}</div>
              
              <div class="label">Approved By:</div>
              <div class="value">${purchaseOrder.approvedBy || purchaseOrder.approved_by || ''}</div>
              
              <div class="label">Date Created:</div>
              <div class="value">${purchaseOrder.created_at ? formatDate(purchaseOrder.created_at) : 'N/A'}</div>
              
              <div class="label">Priority:</div>
              <div class="value">${purchaseOrder.is_urgent ? 'Urgent' : 'Not Urgent'}</div>
              
              <div class="label">Shipping Method:</div>
              <div class="value">${purchaseOrder.next_day_air ? 'Next Day Air' : 'Regular Shipping'}</div>
            </div>
          </div>
          
          <div class="section-title">Order Items</div>
          <table>
            <thead>
              <tr>
                <th>Part Name</th>
                <th>Part #</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${item.display_part_name || 'No Name'}</td>
                  <td>${item.display_part_number || '-'}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${formatCurrency(item.price || item.unit_price || 0)}</td>
                  <td>${formatCurrency((item.price || item.unit_price || 0) * (item.quantity || 0))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <table class="totals">
            <tr>
              <td class="total-label">Subtotal:</td>
              <td>${formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td class="total-label">Shipping Cost:</td>
              <td>${formatCurrency(shippingCost)}</td>
            </tr>
            <tr>
              <td class="total-label">Tax Amount:</td>
              <td>${formatCurrency(taxAmount)}</td>
            </tr>
            <tr class="grand-total">
              <td class="total-label">TOTAL:</td>
              <td>${formatCurrency(totalAmount)}</td>
            </tr>
          </table>
          

          
        </div>
      </body>
      </html>
    `;
    
    // Options for PDF generation
    const options = {
      margin: 10,
      filename: `PO_${purchaseOrder.poNumber || purchaseOrder.po_number || 'Document'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        allowTaint: true,
        useCORS: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Generate PDF
    if (returnBlob) {
      const pdfBlob = await html2pdf().set(options).from(html).outputPdf('blob');
      return pdfBlob;
    } else {
      const element = document.createElement('div');
      element.innerHTML = html;
      document.body.appendChild(element);
      
      await html2pdf()
        .set(options)
        .from(element)
        .save()
        .then(() => {
          document.body.removeChild(element);
        });
    }
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Please allow popups for this website to generate the purchase order PDF.');
  }
};
