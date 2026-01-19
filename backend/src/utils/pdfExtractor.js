const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPDF(filePath) {
  try {
    console.log('Reading PDF file:', filePath);
    
    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    console.log('PDF file size:', dataBuffer.length, 'bytes');
    
    // Parse the PDF content
    const data = await pdfParse(dataBuffer);
    
    console.log('PDF metadata:', {
      pages: data.numpages,
      info: data.info,
      textLength: data.text.length
    });
    
    // Return the text content
    return data.text;
  } catch (error) {
    console.error(`Error extracting text from PDF ${filePath}:`, error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

module.exports = {
  extractTextFromPDF
};