import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Part } from '../types';

interface PartQuantityChartProps {
  data: Part[];
}

const PartQuantityChart: React.FC<PartQuantityChartProps> = ({ data }) => {
  const chartData = data.map(part => ({
    name: part.name,
    quantity: part.quantity
  }));

  return (
    <div style={{ width: '100%', height: 400 }}>
      {data.length > 0 ? (
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="quantity"
              fill="#0d6efd"
              name="Quantity"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center p-4">No data available</div>
      )}
    </div>
  );
};

export default PartQuantityChart;