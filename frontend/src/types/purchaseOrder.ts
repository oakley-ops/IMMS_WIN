export interface Vendor {
  vendor_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  supplier_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PartSupplier {
  part_supplier_id?: number;
  part_id: number;
  supplier_id: number;
  supplier_name?: string;
  unit_cost: number;
  is_preferred?: boolean;
  lead_time_days?: number;
  minimum_order_quantity?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderItem {
  item_id?: number;
  po_id?: number;
  part_id?: number;
  part_name?: string;
  manufacturer_part_number?: string;
  fiserv_part_number?: string;
  custom_part_name?: string;
  custom_part_number?: string;
  custom_part?: boolean;
  quantity: number;
  unit_price: number;
  total_price?: number;
  notes?: string;
  created_at?: string;
}

export interface PurchaseOrder {
  po_id?: number;
  po_number?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_address?: string;
  vendor_email?: string;
  vendor_phone?: string;
  supplier_id?: number;
  supplier_name?: string;
  supplier_address?: string;
  supplier_email?: string;
  supplier_phone?: string;
  contact_name?: string;
  status?: 'pending' | 'submitted' | 'approved' | 'rejected' | 'received' | 'canceled' | 'on_hold';
  approval_status?: 'pending' | 'approved' | 'rejected';
  approval_date?: string;
  approval_email?: string;
  total_amount?: number;
  shipping_cost?: number;
  tax_amount?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseOrderItem[];
  is_urgent?: boolean;
  next_day_air?: boolean;
  priority?: 'urgent' | 'normal';
  requested_by?: string;
  approved_by?: string;
}

export interface Part {
  part_id: number;
  name: string;
  description?: string;
  fiserv_part_number: string;
  manufacturer_part_number?: string;
  quantity: number;
  minimum_quantity: number;
  order_quantity?: number;
  editable_quantity?: number;
  unit_cost: number;
  supplier_id?: number;
  supplier_name?: string;
  vendor_id?: number;
  vendor_name?: string;
  location?: string;
  is_serialized?: boolean;
  is_lot_tracked?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Export LowStockPart as Part for more general usage
export type LowStockPart = Part;
