import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PODocumentsList from '../../../components/purchaseOrders/PODocumentsList';
import { purchaseOrdersApi } from '../../../services/api';
import { PODocument } from '../../../types/documents';

// Mock the API
jest.mock('../../../services/api', () => ({
  purchaseOrdersApi: {
    getDocumentsByPOId: jest.fn(),
    downloadPODocument: jest.fn()
  }
}));

describe('PODocumentsList', () => {
  const mockDocuments: PODocument[] = [
    {
      document_id: 1,
      po_id: 123,
      file_name: 'PO-123-receipt.pdf',
      document_type: 'receipt',
      created_at: '2023-05-01T10:00:00Z',
      created_by: 'testuser'
    },
    {
      document_id: 2,
      po_id: 123,
      file_name: 'PO-123-invoice.pdf',
      document_type: 'invoice',
      created_at: '2023-05-02T11:00:00Z',
      created_by: 'testuser'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (purchaseOrdersApi.getDocumentsByPOId as jest.Mock).mockResolvedValue({ data: mockDocuments });
  });

  test('should render documents list', async () => {
    render(<PODocumentsList poId={123} />);
    
    // Wait for the loading state to resolve
    await waitFor(() => {
      expect(screen.getByText('PO-123-receipt.pdf')).toBeInTheDocument();
    });
    
    expect(screen.getByText('receipt')).toBeInTheDocument();
    expect(screen.getByText('invoice')).toBeInTheDocument();
    expect(purchaseOrdersApi.getDocumentsByPOId).toHaveBeenCalledWith(123);
  });

  test('should download document when download button is clicked', async () => {
    // Mock the download function
    (purchaseOrdersApi.downloadPODocument as jest.Mock).mockResolvedValue({});
    
    render(<PODocumentsList poId={123} />);
    
    // Wait for the loading state to resolve
    await waitFor(() => {
      expect(screen.getByText('PO-123-receipt.pdf')).toBeInTheDocument();
    });
    
    // Find all download buttons
    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    expect(downloadButtons.length).toBe(2);
    
    // Click the first download button
    fireEvent.click(downloadButtons[0]);
    
    await waitFor(() => {
      expect(purchaseOrdersApi.downloadPODocument).toHaveBeenCalledWith(1);
    });
  });

  test('should show empty state when no documents', async () => {
    (purchaseOrdersApi.getDocumentsByPOId as jest.Mock).mockResolvedValue({ data: [] });
    
    render(<PODocumentsList poId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('No documents available for this purchase order')).toBeInTheDocument();
    });
  });

  test('should show error state when API fails', async () => {
    (purchaseOrdersApi.getDocumentsByPOId as jest.Mock).mockRejectedValue(new Error('API error'));
    
    render(<PODocumentsList poId={123} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load documents')).toBeInTheDocument();
    });
  });

  test('should handle download errors', async () => {
    (purchaseOrdersApi.downloadPODocument as jest.Mock).mockRejectedValue(new Error('Download failed'));
    
    // Mock window.alert for testing
    const mockAlert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<PODocumentsList poId={123} />);
    
    // Wait for the loading state to resolve
    await waitFor(() => {
      expect(screen.getByText('PO-123-receipt.pdf')).toBeInTheDocument();
    });
    
    // Find and click the first download button
    const downloadButtons = screen.getAllByRole('button', { name: /download/i });
    fireEvent.click(downloadButtons[0]);
    
    await waitFor(() => {
      expect(purchaseOrdersApi.downloadPODocument).toHaveBeenCalledWith(1);
      expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('Failed to download'));
    });
    
    mockAlert.mockRestore();
  });

  test('should format dates correctly', async () => {
    render(<PODocumentsList poId={123} />);
    
    // Wait for the loading state to resolve
    await waitFor(() => {
      expect(screen.getByText('PO-123-receipt.pdf')).toBeInTheDocument();
    });
    
    // Check for formatted dates (the exact format will depend on the implementation)
    const dateElements = screen.getAllByText(expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/));
    expect(dateElements.length).toBeGreaterThan(0);
  });
}); 