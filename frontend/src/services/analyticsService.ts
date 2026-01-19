import axiosInstance from '../utils/axios';

export interface InventoryHealth {
  average_turnover_rate: number;
  stock_coverage_days: number;
  high_risk_parts: Array<{
    part_id: number;
    name: string;
    risk_score: number;
    days_until_stockout: number;
    current_quantity?: number;
    minimum_quantity?: number;
    avg_daily_usage?: number;
  }>;
}

export interface UsagePatterns {
  fastest_moving_parts: Array<{
    part_id: number;
    name: string;
    trend: number;
    usage_last_30_days: number;
    avg_weekly_usage?: number;
  }>;
  high_velocity_parts?: Array<{
    part_id: number;
    name: string;
    usage_frequency: number;
    total_quantity: number;
  }>;
}

export interface CostAnalysis {
  total_inventory_value: number;
  average_part_cost: number;
  total_parts?: number;
  parts_with_cost?: number;
  highest_value_parts: Array<{
    part_id: number;
    name: string;
    total_value: number;
    quantity: number;
    unit_cost: number;
    manufacturer_part_number?: string;
    crc_part_number?: string;
  }>;
  cost_trends?: Array<{
    month: string;
    month_cost: number;
    unique_parts?: number;
    total_quantity?: number;
  }>;
  cost_by_machine?: Array<{
    machine_id: number;
    machine_name: string;
    total_cost: number;
    unique_parts: number;
  }>;
}

class AnalyticsService {
  async getInventoryHealth(): Promise<InventoryHealth> {
    console.log('Fetching inventory health analytics from backend...');
    const response = await axiosInstance.get<InventoryHealth>('/api/v1/analytics/inventory-health');
    console.log('Inventory health data received:', response.data);
    return {
      ...response.data,
      average_turnover_rate: parseFloat(response.data.average_turnover_rate as any),
      stock_coverage_days: parseInt(response.data.stock_coverage_days as any)
    };
  }

  async getUsagePatterns(): Promise<UsagePatterns> {
    console.log('Fetching usage patterns analytics from backend...');
    const response = await axiosInstance.get<UsagePatterns>('/api/v1/analytics/usage-patterns');
    console.log('Usage patterns data received:', response.data);
    return response.data;
  }

  async getCostAnalysis(): Promise<CostAnalysis> {
    console.log('Fetching cost analysis from backend...');
    const response = await axiosInstance.get<CostAnalysis>('/api/v1/analytics/cost-analysis');
    console.log('Cost analysis data received:', response.data);
    return {
      ...response.data,
      total_inventory_value: parseFloat(response.data.total_inventory_value as any),
      average_part_cost: parseFloat(response.data.average_part_cost as any)
    };
  }

  async getAnalyticsSummary(): Promise<{
    inventory_health: Partial<InventoryHealth>;
    usage_patterns: Partial<UsagePatterns>;
    cost_analysis: Partial<CostAnalysis>;
  }> {
    console.log('Fetching analytics summary from backend...');
    const response = await axiosInstance.get('/api/v1/analytics/summary');
    return response.data;
  }

  async exportAnalyticsPDF(): Promise<Blob> {
    console.log('Requesting PDF export (PDFKit)...');
    const response = await axiosInstance.get('/api/v1/analytics/export/pdf', {
      responseType: 'blob'
    });
    return response.data;
  }

  async exportAnalyticsPDFPuppeteer(): Promise<Blob> {
    console.log('Requesting PDF export (Puppeteer - Chrome rendering)...');
    const response = await axiosInstance.get('/api/v1/analytics/export/pdf-puppeteer', {
      responseType: 'blob'
    });
    return response.data;
  }
}

export const analyticsService = new AnalyticsService(); 