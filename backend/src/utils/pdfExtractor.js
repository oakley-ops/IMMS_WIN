const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text content
 */
async function extractTextFromPDF(filePath) {
  try {
    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Parse the PDF content
    const data = await pdfParse(dataBuffer);
    
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