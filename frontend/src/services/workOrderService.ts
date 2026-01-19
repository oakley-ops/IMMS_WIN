import axiosInstance from '../utils/axios';
import {
  WorkOrder,
  WorkOrderDetail,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest,
  WorkOrderFilters,
  WorkOrderStats,
  WorkOrderComment,
  WorkOrderTask
} from '../types/workOrder';

class WorkOrderService {
  /**
   * Get all work orders with optional filters
   */
  async getWorkOrders(filters?: WorkOrderFilters): Promise<WorkOrder[]> {
    const params = new URLSearchParams();
    
    if (filters?.status) params.append('status', filters.status);
    if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to.toString());
    if (filters?.machine_id) params.append('machine_id', filters.machine_id.toString());
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.work_type) params.append('work_type', filters.work_type);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const url = `/api/v1/work-orders${queryString ? `?${queryString}` : ''}`;
    
    const response = await axiosInstance.get<WorkOrder[]>(url);
    return response.data;
  }

  /**
   * Get single work order with all details
   */
  async getWorkOrderById(id: number): Promise<WorkOrderDetail> {
    const response = await axiosInstance.get<WorkOrderDetail>(`/api/v1/work-orders/${id}`);
    return response.data;
  }

  /**
   * Create new work order
   */
  async createWorkOrder(data: CreateWorkOrderRequest): Promise<WorkOrder> {
    const response = await axiosInstance.post<WorkOrder>('/api/v1/work-orders', data);
    return response.data;
  }

  /**
   * Update existing work order
   */
  async updateWorkOrder(id: number, data: UpdateWorkOrderRequest): Promise<WorkOrder> {
    const response = await axiosInstance.put<WorkOrder>(`/api/v1/work-orders/${id}`, data);
    return response.data;
  }

  /**
   * Delete work order
   */
  async deleteWorkOrder(id: number): Promise<void> {
    await axiosInstance.delete(`/api/v1/work-orders/${id}`);
  }

  /**
   * Add comment to work order
   */
  async addComment(workOrderId: number, commentText: string, technicianId?: number): Promise<WorkOrderComment> {
    const response = await axiosInstance.post<WorkOrderComment>(
      `/api/v1/work-orders/${workOrderId}/comments`,
      {
        comment_text: commentText,
        technician_id: technicianId
      }
    );
    return response.data;
  }

  /**
   * Update task completion status
   */
  async updateTask(
    workOrderId: number,
    taskId: number,
    isCompleted: boolean,
    completedBy?: number
  ): Promise<WorkOrderTask> {
    const response = await axiosInstance.put<WorkOrderTask>(
      `/api/v1/work-orders/${workOrderId}/tasks/${taskId}`,
      {
        is_completed: isCompleted,
        completed_by: completedBy
      }
    );
    return response.data;
  }

  /**
   * Get work order statistics for dashboard
   */
  async getStats(): Promise<WorkOrderStats> {
    const response = await axiosInstance.get<WorkOrderStats>('/api/v1/work-orders/stats/dashboard');
    return response.data;
  }

  /**
   * Start work order (change status to in_progress)
   */
  async startWorkOrder(id: number): Promise<WorkOrder> {
    return this.updateWorkOrder(id, {
      status: 'in_progress',
      started_at: new Date().toISOString()
    });
  }

  /**
   * Complete work order
   */
  async completeWorkOrder(id: number, actualHours?: number): Promise<WorkOrder> {
    return this.updateWorkOrder(id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      actual_hours: actualHours
    });
  }

  /**
   * Put work order on hold
   */
  async holdWorkOrder(id: number): Promise<WorkOrder> {
    return this.updateWorkOrder(id, {
      status: 'on_hold'
    });
  }

  /**
   * Cancel work order
   */
  async cancelWorkOrder(id: number): Promise<WorkOrder> {
    return this.updateWorkOrder(id, {
      status: 'cancelled'
    });
  }

  /**
   * Export work order as PDF for technicians
   */
  async exportWorkOrderPDF(workOrderId: number): Promise<void> {
    try {
      const response = await axiosInstance.get(`/api/v1/work-orders/${workOrderId}/pdf`, {
        responseType: 'blob'
      });

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'work-order.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting work order PDF:', error);
      throw error;
    }
  }
}

export const workOrderService = new WorkOrderService();
export default workOrderService;

