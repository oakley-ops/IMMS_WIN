const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

class PartImageService {
  constructor(pool) {
    this.pool = pool;
  }

  async uploadPartImage(partId, file, username) {
    try {
      // Create directories
      const imagesDir = path.join(process.cwd(), 'uploads', 'part_images');
      const thumbsDir = path.join(process.cwd(), 'uploads', 'part_images', 'thumbs');
      await fs.mkdir(imagesDir, { recursive: true });
      await fs.mkdir(thumbsDir, { recursive: true });

      // Detect if it's likely a screenshot vs photo
      const metadata = await sharp(file.path).metadata();
      const isScreenshot = 
        metadata.format === 'png' || 
        metadata.density < 150 || 
        (metadata.width > 1000 && metadata.height > 700);

      // Generate filenames
      const timestamp = Date.now();
      const ext = isScreenshot ? 'png' : 'jpg';
      const filename = `part-${partId}-${timestamp}.${ext}`;
      const thumbFilename = `part-${partId}-${timestamp}-thumb.jpg`;
      
      const imagePath = path.join(imagesDir, filename);
      const thumbPath = path.join(thumbsDir, thumbFilename);

      // Process main image based on type
      if (isScreenshot) {
        // Screenshots often have text - preserve sharpness
        await sharp(file.path)
          .resize(1200, 900, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .png({ quality: 90 })
          .toFile(imagePath);
      } else {
        // Photos can be compressed more aggressively
        await sharp(file.path)
          .resize(800, 600, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toFile(imagePath);
      }

      // Create thumbnail
      await sharp(file.path)
        .resize(150, 150, { 
          fit: 'cover' 
        })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      // Clean up temp file
      await fs.unlink(file.path);

      // Delete old image if exists
      const oldImageResult = await this.pool.query(
        'SELECT image_url FROM parts WHERE part_id = $1',
        [partId]
      );
      
      if (oldImageResult.rows[0]?.image_url) {
        const oldImagePath = path.join(process.cwd(), oldImageResult.rows[0].image_url);
        await fs.unlink(oldImagePath).catch(() => {}); // Silent fail if file doesn't exist
        
        // Also delete old thumbnail
        const oldThumbPath = oldImagePath.replace('/part_images/', '/part_images/thumbs/').replace(/\.(jpg|png)$/, '-thumb.jpg');
        await fs.unlink(oldThumbPath).catch(() => {}); // Silent fail
      }

      // Update database
      const imageUrl = `/uploads/part_images/${filename}`;
      const thumbUrl = `/uploads/part_images/thumbs/${thumbFilename}`;
      
      await this.pool.query(
        'UPDATE parts SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE part_id = $2',
        [imageUrl, partId]
      );

      return { 
        imageUrl, 
        thumbUrl, 
        imageType: isScreenshot ? 'screenshot' : 'photo',
        filename 
      };

    } catch (error) {
      console.error('Error uploading part image:', error);
      // Clean up temp file if it exists
      if (file.path) {
        await fs.unlink(file.path).catch(() => {});
      }
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  async deletePartImage(partId) {
    try {
      // Get current image URL
      const result = await this.pool.query(
        'SELECT image_url FROM parts WHERE part_id = $1',
        [partId]
      );
      
      if (result.rows[0]?.image_url) {
        const imageUrl = result.rows[0].image_url;
        const imagePath = path.join(process.cwd(), imageUrl);
        
        // Delete main image
        await fs.unlink(imagePath).catch(() => {}); // Silent fail if file doesn't exist
        
        // Delete thumbnail
        const thumbPath = imagePath.replace('/part_images/', '/part_images/thumbs/').replace(/\.(jpg|png)$/, '-thumb.jpg');
        await fs.unlink(thumbPath).catch(() => {}); // Silent fail
      }

      // Clear image_url in database
      await this.pool.query(
        'UPDATE parts SET image_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE part_id = $1',
        [partId]
      );

      return { message: 'Image deleted successfully' };
    } catch (error) {
      console.error('Error deleting part image:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  async ensureDirectories() {
    const imagesDir = path.join(process.cwd(), 'uploads', 'part_images');
    const thumbsDir = path.join(process.cwd(), 'uploads', 'part_images', 'thumbs');
    await fs.mkdir(imagesDir, { recursive: true });
    await fs.mkdir(thumbsDir, { recursive: true });
  }
}

module.exports = PartImageService; 