import React, { useState, useRef } from 'react';
import { PRIMARY_ORANGE } from '../theme';
import { 
  Box, 
  Button, 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  IconButton,
  Typography,
  CircularProgress,
  Paper,
  Chip,
  DialogActions
} from '@mui/material';
import { 
  PhotoCamera, 
  Delete, 
  Close, 
  CloudUpload, 
  Screenshot,
  Phone,
  Videocam,
  VideocamOff,
  CameraAlt,
  Refresh
} from '@mui/icons-material';
import axiosInstance from '../utils/axios';
import { resolveAssetUrl } from '../config';

interface PartImageUploadProps {
  partId: number;
  currentImageUrl?: string | null;
  onImageUpdate: (imageUrl: string | null) => void;
}

const PartImageUpload: React.FC<PartImageUploadProps> = ({ 
  partId, 
  currentImageUrl, 
  onImageUpdate 
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await axiosInstance.post(`/api/v1/parts/${partId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onImageUpdate(response.data.imageUrl);
      
      // Show success message with image type
      const imageType = response.data.imageType === 'screenshot' ? 'Screenshot' : 'Photo';
      console.log(`${imageType} uploaded successfully`);

    } catch (error: any) {
      console.error('Error uploading image:', error);
      setError(error.response?.data?.error || 'Error uploading image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    try {
      await axiosInstance.delete(`/api/v1/parts/${partId}/image`);
      onImageUpdate(null);
    } catch (error: any) {
      console.error('Error deleting image:', error);
      setError(error.response?.data?.error || 'Error deleting image. Please try again.');
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(file);
            break;
          }
        }
      }
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setCapturedImage(null);
    
    // Debug camera availability
    debugCameraAvailability();
    
    // Check if MediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      
      if (protocol === 'http:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        setCameraError(`📱 Camera access requires HTTPS. You're currently on ${protocol}//${hostname}. 
        
🔒 To enable camera access:
1. Access the site via HTTPS: https://${hostname}
2. Or use localhost: http://localhost:3000
3. Or upload a file using the buttons below

ℹ️ If you're on a Raspberry Pi, run the HTTPS setup script to enable camera access.`);
      } else {
        setCameraError('Camera access is not supported in this browser. Please use a modern browser or try uploading a file instead.');
      }
      return;
    }
    
    // Check if we're on HTTPS (required for camera access)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraError(`📱 Camera access requires HTTPS connection. 
      
🔒 To enable camera access:
1. Access the site via HTTPS: https://${window.location.hostname}
2. Or use localhost: http://localhost:3000
3. Or upload a file using the buttons below

ℹ️ If you're on a Raspberry Pi, run: bash scripts/setup-https-camera.sh`);
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment' // Use back camera if available
        } 
      });
      
      setCameraStream(stream);
      setCameraOpen(true);
      
      // Set video source after a brief delay to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      
      let errorMessage = 'Unable to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Camera access was denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found. Please ensure a camera is connected.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera is not supported in this browser.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is being used by another application.';
      } else {
        errorMessage += 'Please check permissions and try again.';
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraOpen(false);
    setCapturedImage(null);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context?.drawImage(video, 0, 0);
      
      // Convert canvas to data URL
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageDataUrl);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
  };

  const uploadCapturedPhoto = async () => {
    if (!capturedImage) return;
    
    try {
      // Convert data URL to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      
      // Create file from blob
      const file = new File([blob], `webcam-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Upload the file
      await handleImageUpload(file);
      
      // Close camera after successful upload
      stopCamera();
    } catch (error) {
      console.error('Error uploading captured photo:', error);
      setError('Error uploading captured photo. Please try again.');
    }
  };

  const detectImageType = (url: string) => {
    if (url.includes('.png')) return 'screenshot';
    if (url.includes('.jpg') || url.includes('.jpeg')) return 'photo';
    return 'image';
  };

  // Debug function to check camera availability
  const debugCameraAvailability = () => {
    console.log('=== Camera Availability Debug ===');
    console.log('navigator.mediaDevices:', navigator.mediaDevices);
    console.log('getUserMedia:', navigator.mediaDevices?.getUserMedia);
    console.log('Protocol:', window.location.protocol);
    console.log('Hostname:', window.location.hostname);
    console.log('Camera API available:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Error Message */}
      {error && (
        <Box sx={{ 
          p: 2, 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: 1,
          fontSize: '0.875rem' 
        }}>
          {error}
        </Box>
      )}

      {/* Current Image Preview */}
      {currentImageUrl && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ position: 'relative' }}>
            <img
              src={resolveAssetUrl(currentImageUrl)}
              alt="Part"
              style={{
                width: 120,
                height: 120, 
                objectFit: 'cover', 
                borderRadius: 8,
                border: '1px solid #ddd',
                cursor: 'pointer'
              }}
              onClick={() => setPreviewOpen(true)}
            />
            <Chip
              size="small"
              label={detectImageType(currentImageUrl)}
              icon={detectImageType(currentImageUrl) === 'screenshot' ? <Screenshot /> : <Phone />}
              sx={{ 
                position: 'absolute', 
                top: 4, 
                right: 4,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white'
              }}
            />
          </Box>
          <IconButton 
            color="error" 
            onClick={handleDeleteImage}
            disabled={uploading}
          >
            <Delete />
          </IconButton>
        </Box>
      )}

      {/* Upload Area */}
      <Paper
        sx={{
          p: 3,
          border: dragOver ? `2px dashed ${PRIMARY_ORANGE}` : '2px dashed #ccc',
          backgroundColor: dragOver ? '#fff5f0' : '#fafafa',
          textAlign: 'center',
          cursor: 'pointer'
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        onPaste={handlePaste}
        tabIndex={0}
      >
        {uploading ? (
          <CircularProgress />
        ) : (
          <>
            <CloudUpload sx={{ fontSize: 48, color: PRIMARY_ORANGE, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {currentImageUrl ? 'Replace Image' : 'Upload Part Image'}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Drag & drop, paste from clipboard, or click to browse
            </Typography>
            
            {/* Usage Examples */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
              <Chip 
                icon={<Phone />} 
                label="iPhone Photos" 
                variant="outlined" 
                size="small"
              />
              <Chip 
                icon={<Screenshot />} 
                label="PC Screenshots" 
                variant="outlined" 
                size="small"
              />
              <Chip 
                icon={<Videocam />} 
                label="Webcam" 
                variant="outlined" 
                size="small"
              />
            </Box>
            
            <Typography variant="caption" display="block" sx={{ mt: 2 }}>
              Supports: JPEG, PNG, HEIC, WebP, BMP, TIFF (up to 15MB)
            </Typography>
            <Typography variant="caption" display="block">
              💡 Tip: Use Ctrl+V to paste screenshots directly
            </Typography>
          </>
        )}
      </Paper>

      {/* Camera Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<Videocam />}
          onClick={startCamera}
          disabled={uploading}
          sx={{ color: PRIMARY_ORANGE, borderColor: PRIMARY_ORANGE }}
        >
          Take Photo with Camera
        </Button>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="image/*"
        onChange={handleFileInput}
        disabled={uploading}
      />

      {/* Camera Dialog */}
      <Dialog 
        open={cameraOpen} 
        onClose={stopCamera}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Take Photo
          <IconButton
            sx={{ position: 'absolute', right: 8, top: 8 }}
            onClick={stopCamera}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {cameraError ? (
            <Box sx={{ textAlign: 'center', p: 3 }}>
              <VideocamOff sx={{ fontSize: 48, color: '#f44336', mb: 2 }} />
              <Typography color="error">{cameraError}</Typography>
              <Button 
                variant="outlined" 
                onClick={startCamera} 
                sx={{ mt: 2 }}
                startIcon={<Refresh />}
              >
                Try Again
              </Button>
            </Box>
          ) : (
            <>
              {!capturedImage ? (
                <Box sx={{ position: 'relative' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      maxWidth: '600px',
                      height: 'auto',
                      borderRadius: 8,
                      backgroundColor: '#000'
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    style={{ display: 'none' }}
                  />
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center' }}>
                  <img
                    src={capturedImage}
                    alt="Captured"
                    style={{
                      width: '100%',
                      maxWidth: '600px',
                      height: 'auto',
                      borderRadius: 8
                    }}
                  />
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {!cameraError && (
            <>
              {!capturedImage ? (
                <Button
                  variant="contained"
                  onClick={capturePhoto}
                  startIcon={<CameraAlt />}
                  sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e55a00' } }}
                >
                  Capture Photo
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    onClick={retakePhoto}
                    startIcon={<Refresh />}
                  >
                    Retake
                  </Button>
                  <Button
                    variant="contained"
                    onClick={uploadCapturedPhoto}
                    startIcon={<CloudUpload />}
                    disabled={uploading}
                    sx={{ backgroundColor: PRIMARY_ORANGE, '&:hover': { backgroundColor: '#e55a00' } }}
                  >
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Full Size Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Part Image Preview
          <IconButton
            sx={{ position: 'absolute', right: 8, top: 8 }}
            onClick={() => setPreviewOpen(false)}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {currentImageUrl && (
            <img
              src={resolveAssetUrl(currentImageUrl)}
              alt="Part"
              style={{
                width: '100%',
                maxWidth: '600px',
                height: 'auto',
                borderRadius: 8
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PartImageUpload; 