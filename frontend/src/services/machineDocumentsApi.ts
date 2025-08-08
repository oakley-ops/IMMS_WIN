import axios, { AxiosInstance } from 'axios';
import { API_URL } from '../config';
import { MachineDocument, MachineDocumentUpload } from '../types/documents';

// Create API instance with longer timeout for file operations
const machineDocumentsApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 180000, // 3 minutes for file uploads
});

// Add auth token interceptor
machineDocumentsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Get all documents for a machine
 * @param machineId Machine ID
 * @returns Promise with documents array
 */
export const getMachineDocuments = (machineId: number): Promise<{ data: MachineDocument[] }> => {
  console.log(`Fetching documents for machine ID: ${machineId}`);
  return machineDocumentsApi.get(`/api/v1/machines/${machineId}/documents`);
};

/**
 * Upload a document for a machine
 * @param machineId Machine ID
 * @param documentData Document upload data
 * @returns Promise with the upload response
 */
export const uploadMachineDocument = (
  machineId: number,
  documentData: MachineDocumentUpload
): Promise<{ data: MachineDocument }> => {
  console.log(`Uploading document for machine ID: ${machineId}`);
  
  const formData = new FormData();
  formData.append('document', documentData.file);
  formData.append('category', documentData.category);
  formData.append('title', documentData.title);
  formData.append('description', documentData.description);

  return machineDocumentsApi.post(`/api/v1/machines/${machineId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * View a document inline in browser
 * @param machineId Machine ID
 * @param documentId Document ID
 * @returns Promise with blob URL to view the document
 */
export const viewMachineDocument = async (
  machineId: number,
  documentId: number
): Promise<string> => {
  console.log(`Viewing document ID: ${documentId} for machine ID: ${machineId}`);
  
  try {
    // Make authenticated request to get the document
    const response = await machineDocumentsApi.get(`/api/v1/machines/${machineId}/documents/${documentId}/view`, {
      responseType: 'blob'
    });
    
    // Get content type from response headers or default to application/octet-stream
    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // Create blob URL with correct content type for viewing
    const blob = new Blob([response.data], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    
    return url;
  } catch (error) {
    console.error('Error viewing document:', error);
    throw error;
  }
};

/**
 * Download a document
 * @param machineId Machine ID
 * @param documentId Document ID
 * @returns Promise with the file blob
 */
export const downloadMachineDocument = (
  machineId: number,
  documentId: number
): Promise<{ data: Blob }> => {
  console.log(`Downloading document ID: ${documentId} for machine ID: ${machineId}`);
  return machineDocumentsApi.get(`/api/v1/machines/${machineId}/documents/${documentId}`, {
    responseType: 'blob'
  });
};

/**
 * Update document metadata
 * @param machineId Machine ID
 * @param documentId Document ID
 * @param updates Updates to apply
 * @returns Promise with the updated document
 */
export const updateMachineDocument = (
  machineId: number,
  documentId: number,
  updates: Partial<Pick<MachineDocument, 'title' | 'description' | 'document_category'>>
): Promise<{ data: MachineDocument }> => {
  console.log(`Updating document ID: ${documentId} for machine ID: ${machineId}`);
  return machineDocumentsApi.put(`/api/v1/machines/${machineId}/documents/${documentId}`, updates);
};

/**
 * Delete a document
 * @param machineId Machine ID
 * @param documentId Document ID
 * @returns Promise with the deletion response
 */
export const deleteMachineDocument = (
  machineId: number,
  documentId: number
): Promise<{ data: { message: string } }> => {
  console.log(`Deleting document ID: ${documentId} for machine ID: ${machineId}`);
  return machineDocumentsApi.delete(`/api/v1/machines/${machineId}/documents/${documentId}`);
};

/**
 * Search documents for a machine
 * @param machineId Machine ID
 * @param searchTerm Search term
 * @returns Promise with matching documents
 */
export const searchMachineDocuments = (
  machineId: number,
  searchTerm: string
): Promise<{ data: MachineDocument[] }> => {
  console.log(`Searching documents for machine ID: ${machineId} with term: ${searchTerm}`);
  return machineDocumentsApi.get(`/api/v1/machines/${machineId}/documents/search`, {
    params: { q: searchTerm }
  });
};

/**
 * Helper function to format file size
 * @param bytes File size in bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Helper function to get file extension from filename
 * @param filename File name
 * @returns File extension
 */
export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || '';
};

/**
 * Helper function to check if file is an image
 * @param mimeType MIME type
 * @returns Whether file is an image
 */
export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

/**
 * Helper function to check if file is a PDF
 * @param mimeType MIME type
 * @returns Whether file is a PDF
 */
export const isPDFFile = (mimeType: string): boolean => {
  return mimeType === 'application/pdf';
}; 