const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * AI Document Extractor Service
 * Uses Hugging Face's free API to extract structured data from document images
 */
class AiDocumentExtractor {
  constructor() {
    // Using Hugging Face's free public inference API (no API key required)
    this.apiUrl = 'https://api-inference.huggingface.co/models/naver-clova-ix/donut-base-finetuned-cord-v2';
    this.timeout = 60000; // 60 seconds for AI processing
  }

  /**
   * Extract structured data from a document image
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<Object>} Extracted document data
   */
  async extractFromImage(imagePath) {
    try {
      console.log('Reading image file:', imagePath);
      const imageBuffer = await fs.readFile(imagePath);
      
      console.log('Sending image to Hugging Face AI model...');
      const response = await axios.post(
        this.apiUrl,
        imageBuffer,
        {
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          timeout: this.timeout,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      console.log('AI extraction response:', JSON.stringify(response.data, null, 2));
      
      return this.parseAiResponse(response.data);
    } catch (error) {
      if (error.response?.status === 503) {
        console.error('AI model is loading, this may take 20-30 seconds on first use');
        throw new Error('AI model is warming up. Please try again in 30 seconds.');
      }
      console.error('AI extraction error:', error.message);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

  /**
   * Parse AI model response into structured PO data
   * @param {Object} aiResponse - Response from Hugging Face
   * @returns {Object} Parsed PO data
   */
  parseAiResponse(aiResponse) {
    // Donut model returns structured JSON with extracted fields
    // Parse and normalize the response
    const extracted = {
      vendor: null,
      poNumber: null,
      poDate: null,
      lineItems: [],
      total: 0,
      tax: 0,
      shipTo: null,
      buyer: null,
      rawResponse: aiResponse
    };

    try {
      // The model returns an array, take first result
      const result = Array.isArray(aiResponse) ? aiResponse[0] : aiResponse;
      
      if (result && typeof result === 'object') {
        // Extract vendor info
        if (result.vendor_name || result.store_name || result.company) {
          extracted.vendor = {
            name: result.vendor_name || result.store_name || result.company,
            address: result.vendor_address || result.store_addr || result.address
          };
        }

        // Extract PO number
        extracted.poNumber = result.po_number || result.invoice_number || result.receipt_number;

        // Extract date
        extracted.poDate = result.date || result.invoice_date || result.po_date;

        // Extract line items
        if (result.items && Array.isArray(result.items)) {
          extracted.lineItems = result.items.map(item => ({
            description: item.item_name || item.description || item.name,
            quantity: parseFloat(item.quantity || item.qty || 1),
            unitPrice: parseFloat(item.price || item.unit_price || 0),
            total: parseFloat(item.total || item.total_price || 0)
          }));
        }

        // Extract totals
        extracted.total = parseFloat(result.total || result.total_amount || result.grand_total || 0);
        extracted.tax = parseFloat(result.tax || result.tax_amount || 0);
      }
    } catch (error) {
      console.error('Error parsing AI response:', error);
    }

    return extracted;
  }

  /**
   * Extract data from PDF by converting to image first
   * @param {string} pdfPath - Path to PDF file
   * @returns {Promise<Object>} Extracted document data
   */
  async extractFromPDF(pdfPath) {
    console.log('Converting PDF to image for AI processing...');
    
    // For now, we'll use a simple approach: use sharp to convert PDF
    // Note: This requires the PDF to be converted to image first
    // We'll need to add pdf2pic or similar library
    
    throw new Error('PDF to image conversion not yet implemented. Please implement pdf2pic or use image files.');
  }
}

module.exports = AiDocumentExtractor;
