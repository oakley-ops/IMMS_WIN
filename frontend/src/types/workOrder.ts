// Work Order Management Types

export type WorkOrderStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'on_hold' 
  | 'cancelled';

export type WorkOrderPriority = 
  | 'critical' 
  | 'high' 
  | 'medium' 
  | 'low';

export type WorkType = 
  | 'preventive' 
  | 'corrective' 
  | 'inspection' 
  | 'emergency' 
  | 'installation' 
  | 'calibration';

export interface WorkOrder {
  work_order_id: number;
  work_order_number: string;
  title: string;
  description?: string;
  work_type: WorkType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  machine_name?: string;
  machine_location?: string;
  machine_model?: string;
  technician_name?: string;
  technician_email?: string;
  technician_phone?: string;
  created_by?: number;
  scheduled_date?: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  parts_count?: number;
  total_tasks?: number;
  completed_tasks?: number;
}

export interface WorkOrderPart {
  wo_part_id: number;
  work_order_id: number;
  part_id: number;
  part_name?: string;
  part_number?: string;
  quantity_required: number;
  quantity_used: number;
  available_quantity?: number;
  notes?: string;
  created_at: string;
}

export interface WorkOrderTask {
  task_id: number;
  work_order_id: number;
  task_description: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: number;
  completed_by_name?: string;
  sort_order?: number;
  created_at: string;
}

export interface WorkOrderComment {
  comment_id: number;
  work_order_id: number;
  user_id?: number;
  technician_id?: number;
  technician_name?: string;
  comment_text: string;
  created_at: string;
}

export interface WorkOrderAttachment {
  attachment_id: number;
  work_order_id: number;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: number;
  created_at: string;
}

export interface WorkOrderDetail extends WorkOrder {
  parts: WorkOrderPart[];
  tasks: WorkOrderTask[];
  comments: WorkOrderComment[];
  attachments: WorkOrderAttachment[];
}

export interface CreateWorkOrderRequest {
  title: string;
  description?: string;
  work_type: WorkType;
  priority: WorkOrderPriority;
  machine_name?: string;
  machine_location?: string;
  technician_name?: string;
  scheduled_date?: string;
  due_date?: string;
  estimated_hours?: number;
  notes?: string;
  parts?: Array<{
    part_id: number;
    quantity_required: number;
    notes?: string;
  }>;
  tasks?: Array<string | { task_description: string }>;
}

export interface UpdateWorkOrderRequest {
  title?: string;
  description?: string;
  work_type?: WorkType;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  machine_id?: number;
  assigned_to?: number;
  scheduled_date?: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  notes?: string;
}

export interface WorkOrderFilters {
  status?: WorkOrderStatus;
  assigned_to?: number;
  machine_id?: number;
  priority?: WorkOrderPriority;
  work_type?: WorkType;
  limit?: number;
  offset?: number;
}

export interface WorkOrderStats {
  total_work_orders: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  on_hold_count: number;
  critical_count: number;
  overdue_count: number;
}

// Helper functions for UI display
export const getStatusColor = (status: WorkOrderStatus): string => {
  switch (status) {
    case 'pending': return '#6c757d';
    case 'in_progress': return '#0066A1';
    case 'completed': return '#28a745';
    case 'on_hold': return '#ffc107';
    case 'cancelled': return '#dc3545';
    default: return '#6c757d';
  }
};

export const getPriorityColor = (priority: WorkOrderPriority): string => {
  switch (priority) {
    case 'critical': return '#dc3545';
    case 'high': return '#fd7e14';
    case 'medium': return '#ffc107';
    case 'low': return '#28a745';
    default: return '#6c757d';
  }
};

export const getStatusLabel = (status: WorkOrderStatus): string => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'on_hold': return 'On Hold';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};

export const getPriorityLabel = (priority: WorkOrderPriority): string => {
  switch (priority) {
    case 'critical': return 'Critical';
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    default: return priority;
  }
};

export const getWorkTypeLabel = (workType: WorkType): string => {
  switch (workType) {
    case 'preventive': return 'Preventive Maintenance';
    case 'corrective': return 'Corrective';
    case 'inspection': return 'Inspection';
    case 'emergency': return 'Emergency';
    case 'installation': return 'Installation';
    case 'calibration': return 'Calibration';
    default: return workType;
  }
};

export const getPriorityIcon = (priority: WorkOrderPriority): string => {
  switch (priority) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
};

