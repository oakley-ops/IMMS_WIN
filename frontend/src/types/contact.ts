export interface Contact {
  contact_id: number;
  name: string;
  company: string;
  type: 'vendor' | 'contractor' | 'supplier';
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ContactFormData {
  name: string;
  company: string;
  type: 'vendor' | 'contractor' | 'supplier';
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  notes: string;
  status: 'active' | 'inactive';
}

export type ContactType = 'vendor' | 'contractor' | 'supplier' | 'all';
export type ContactStatus = 'active' | 'inactive' | 'all';