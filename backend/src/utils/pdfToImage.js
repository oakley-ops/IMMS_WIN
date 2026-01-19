const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

/**
 * Convert PDF to image using pdf-poppler (requires poppler utilities installed)
 * Alternative: Use pdf2pic npm package
 */

/**
 * Simple PDF to image converter using pdf2pic
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string>} Path to generated image
 */
async function convertPdfToImage(pdfPath) {
  try {
    // Check if pdf2pic is available
    let pdf2pic;
    try {
      pdf2pic = require('pdf2pic');
    } catch (err) {
      throw new Error('pdf2pic not installed. Run: npm install pdf2pic');
    }

    const outputDir = path.join(path.dirname(pdfPath), 'temp_images');
    await fs.mkdir(outputDir, { recursive: true });

    const converter = pdf2pic.fromPath(pdfPath, {
      density: 300,           // High quality
      saveFilename: path.basename(pdfPath, '.pdf'),
      savePath: outputDir,
      format: 'png',
      width: 2000,
      height: 2000
    });

    console.log('Converting PDF page 1 to image...');
    const result = await converter(1); // Convert first page only
    
    const imagePath = result.path;
    console.log('PDF converted to image:', imagePath);
    
    return imagePath;
  } catch (error) {
    console.error('PDF to image conversion error:', error);
    throw new Error(`Failed to convert PDF to image: ${error.message}`);
  }
}

/**
 * Cleanup temporary image files
 * @param {string} imagePath - Path to image file to delete
 */
async function cleanupImage(imagePath) {
  try {
    await fs.unlink(imagePath);
    console.log('Cleaned up temporary image:', imagePath);
  } catch (error) {
    console.warn('Failed to cleanup image:', error.message);
  }
}

module.exports = {
  convertPdfToImage,
  cleanupImage
};
