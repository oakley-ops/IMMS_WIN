import axios from 'axios';
import axiosInstance from '../utils/axios';

const getAnalyticsApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://fiserv-inventory-analytics.fly.dev';  // Update this with your production analytics URL
  }
  return 'http://localhost:8001';
};

const analyticsAxios = axios.create({
  baseURL: getAnalyticsApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 1000  // Set a short 1-second timeout
});

export interface InventoryHealth {
  average_turnover_rate: number;
  stock_coverage_days: number;
  high_risk_parts: Array<{
    part_id: number;
    name: string;
    risk_score: number;
    days_until_stockout: number;
  }>;
}

export interface UsagePatterns {
  fastest_moving_parts: Array<{
    part_id: number;
    name: string;
    trend: number;
    usage_last_30_days: number;
  }>;
}

export interface CostAnalysis {
  total_inventory_value: number;
  average_part_cost: number;
  highest_value_parts: Array<{
    part_id: number;
    name: string;
    total_value: number;
    quantity: number;
    unit_cost: number;
  }>;
}

// Mock data for testing
const mockInventoryHealth: InventoryHealth = {
  average_turnover_rate: 2.7,
  stock_coverage_days: 45,
  high_risk_parts: [
    { part_id: 1953, name: 'Knife Plate', risk_score: 0.85, days_until_stockout: 12.5 },
    { part_id: 1958, name: 'Cylinder', risk_score: 0.72, days_until_stockout: 18.2 },
    { part_id: 1973, name: 'BRASS TIP ALLOY HEX SOCKET SET SCREW', risk_score: 0.68, days_until_stockout: 21.0 }
  ]
};

const mockUsagePatterns: UsagePatterns = {
  fastest_moving_parts: [
    { part_id: 1953, name: 'Knife Plate', trend: 2.5, usage_last_30_days: 12 },
    { part_id: 1958, name: 'Cylinder', trend: 1.8, usage_last_30_days: 8 },
    { part_id: 1973, name: 'BRASS TIP ALLOY HEX SOCKET SET SCREW', trend: 1.2, usage_last_30_days: 6 }
  ]
};

const mockCostAnalysis: CostAnalysis = {
  total_inventory_value: 128750.45,
  average_part_cost: 342.80,
  highest_value_parts: [
    { part_id: 1953, name: 'Knife Plate', total_value: 3328.20, quantity: 3, unit_cost: 1109.40 },
    { part_id: 2001, name: 'Motor Assembly', total_value: 2650.00, quantity: 1, unit_cost: 2650.00 },
    { part_id: 1958, name: 'Cylinder', total_value: 1875.60, quantity: 4, unit_cost: 468.90 }
  ]
};

class AnalyticsService {
  async getInventoryHealth(): Promise<InventoryHealth> {
    try {
      const response = await axiosInstance.get<InventoryHealth>('/api/v1/analytics/inventory-health');
      return response.data;
    } catch (error) {
      console.log('Using mock inventory health data for testing');
      return mockInventoryHealth;
    }
  }

  async getUsagePatterns(): Promise<UsagePatterns> {
    try {
      const response = await axiosInstance.get<UsagePatterns>('/api/v1/analytics/usage-patterns');
      return response.data;
    } catch (error) {
      console.log('Using mock usage patterns data for testing');
      return mockUsagePatterns;
    }
  }

  async getCostAnalysis(): Promise<CostAnalysis> {
    try {
      const response = await axiosInstance.get<CostAnalysis>('/api/v1/analytics/cost-analysis');
      return response.data;
    } catch (error) {
      console.log('Using mock cost analysis data for testing');
      return mockCostAnalysis;
    }
  }
}

export const analyticsService = new AnalyticsService(); 