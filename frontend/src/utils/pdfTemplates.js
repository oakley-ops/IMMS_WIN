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
    console.log('Calculated Totals:', { subtotal, shippingCost, taxAmount, totalAmount });

    // Fiserv orange color
    const fiservOrange = '#FF6200';

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
            margin-bottom: 30px;
            position: relative;
          }
          .logo {
            max-width: 80px;
            height: auto;
          }
          .header-title {
            color: ${fiservOrange};
            font-size: 16px;
            font-weight: bold;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            top: 0;
          }
          .header-border {
            border-bottom: 2px solid ${fiservOrange};
            margin-top: 30px;
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
            color: ${fiservOrange};
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
            background-color: ${fiservOrange};
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
            border-top: 1px solid ${fiservOrange};
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #555;
          }
          .print-button {
            background-color: ${fiservOrange};
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
            <img src="/assets/fiserv_logo_orange_rgb.png" alt="Fiserv Logo" class="logo">
            <div class="header-title">PURCHASE ORDER</div>
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
              <div class="value">${formatDate(purchaseOrder.createdAt || purchaseOrder.created_at)}</div>
              
              <div class="label">Priority:</div>
              <div class="value">${purchaseOrder.urgent || purchaseOrder.is_urgent ? 'Urgent' : 'Not Urgent'}</div>
              
              <div class="label">Shipping Method:</div>
              <div class="value">${purchaseOrder.nextDayShipping || purchaseOrder.next_day_air ? 'Next Day Air' : 'Regular Shipping'}</div>
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
                  <td>${item.name || item.part_name || ''}</td>
                  <td>${item.partNumber || item.manufacturer_part_number || item.fiserv_part_number || ''}</td>
                  <td>${item.quantity || 0}</td>
                  <td>${formatCurrency(item.price || item.unit_price || 0)}</td>
                  <td>${formatCurrency((item.price || item.unit_price || 0) * (item.quantity || 0))}</td>
                </tr>
              `).join('')}
              ${lineItems.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center;">No items found</td>
                </tr>
              ` : ''}
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
          
          <div class="footer">
            This is an official purchase order document. Please reference PO #${purchaseOrder.poNumber || purchaseOrder.po_number || ''} in all correspondence.
          </div>
          
          ${!returnBlob ? '<button class="print-button" onclick="window.print()">Print / Save as PDF</button>' : ''}
        </div>
      </body>
      </html>
    `;

    // Create a temporary element to hold the HTML content
    const element = document.createElement('div');
    element.innerHTML = html;

    // If we need to return a blob for email attachment
    if (returnBlob) {
      // Configure html2pdf options
      const pdfOptions = {
        margin: 10,
        filename: `PO-${purchaseOrder.po_number || 'export'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      try {
        // Generate PDF using html2pdf
        const pdfBlob = await html2pdf().from(element).set(pdfOptions).outputPdf('blob');
        return pdfBlob;
      } catch (error) {
        console.error('Error generating PDF with html2pdf:', error);
        // Fallback to simple blob
        return new Blob([html], { type: 'application/pdf' });
      }
    }

    // Otherwise proceed with opening in a new window for display/print
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website to generate the purchase order PDF.');
      return Promise.resolve();
    }

    // Write the HTML content to the new window
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Focus the new window
    printWindow.focus();

    return Promise.resolve();
  } catch (error) {
    console.error('Error generating PDF:', error);
    return Promise.reject(error);
  }
};
