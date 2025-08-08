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

// Machine document types
export interface MachineDocument {
  document_id: number;
  machine_id: number;
  file_name: string;
  document_type: string;
  document_category: 'schematic' | 'parts_diagram' | 'pm_instructions' | 'pos' | 'manual' | 'other';
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  file_size: number;
  mime_type: string;
}

export interface MachineDocumentUpload {
  file: File;
  category: MachineDocument['document_category'];
  title: string;
  description: string;
}

export interface DocumentCategory {
  value: MachineDocument['document_category'];
  label: string;
  icon: string;
  color: string;
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  { value: 'schematic', label: 'Schematics', icon: '📋', color: '#2196F3' },
  { value: 'parts_diagram', label: 'Parts Diagrams', icon: '🔧', color: '#FF9800' },
  { value: 'pm_instructions', label: 'PM Instructions', icon: '📝', color: '#4CAF50' },
  { value: 'pos', label: 'POS Documents', icon: '💳', color: '#9C27B0' },
  { value: 'manual', label: 'Manuals', icon: '📖', color: '#795548' },
  { value: 'other', label: 'Other', icon: '📄', color: '#607D8B' }
];

export const getDocumentCategoryInfo = (category: MachineDocument['document_category']): DocumentCategory => {
  return DOCUMENT_CATEGORIES.find(cat => cat.value === category) || DOCUMENT_CATEGORIES[5];
}; 