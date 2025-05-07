export interface Part {
  part_id: string;
  name: string;
  description?: string;
  quantity: number;
  minimum_quantity: number;
  location?: string;
  machine_name?: string;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  created_at: string;
  updated_at: string;
}

export interface UsageHistory {
  date: string;
  part_name: string;
  machine_name: string | null;
  quantity: number;
  type: string;
}

export interface UsageTrend {
  date: string;
  part_name: string;
  usage_quantity: number;
  restock_quantity: number;
}

export interface TopUsedPart {
  part_name: string;
  current_quantity: number;
  minimum_quantity: number;
  total_usage: number;
  usage_frequency: number;
}

export interface DashboardData {
  totalParts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalMachines: number;
  lowStockParts: Part[];
  outOfStockParts: Part[];
  stockLevels: {
    name: string;
    value: number;
  }[];
  topUsedParts: {
    name: string;
    quantity: number;
  }[];
  usageTrends: {
    date: string;
    quantity: number;
  }[];
  // Purchase order stats
  pendingPOCount: number;
  approvedPOCount: number;
  rejectedPOCount: number;
  totalPOCount: number;
  recentPurchaseOrders: {
    po_id: number;
    po_number: string;
    status: string;
    supplier_name: string;
    total_amount: number;
    created_at: string;
  }[];
}

export interface Machine {
  id?: number;
  machine_id?: number;
  name: string;
  model: string;
  serial_number: string;
  location: string;
  manufacturer: string;
  installation_date: string;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  notes: string;
  status: string;
}
