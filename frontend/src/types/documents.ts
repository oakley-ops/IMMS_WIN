/**
 * Document related types
 */

export interface PODocument {
  document_id: number;
  po_id: number;
  file_path?: string;
  file_name: string;
  document_type: string;
  created_at: string;
  created_by: string;
  notes?: string;
} 