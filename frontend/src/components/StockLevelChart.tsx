import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StockLevelData {
  name: string;
  value: number;
}

interface StockLevelChartProps {
  data: StockLevelData[];
}

const StockLevelChart: React.FC<StockLevelChartProps> = ({ data = [] }) => {
  // Guard against undefined data
  if (!data) {
    return <div className="text-center p-4">No data available</div>;
  }

  const chartData = data.map(item => ({
    ...item,
    color: getColorForStockLevel(item.name)
  }));

  function getColorForStockLevel(name: string): string {
    switch (name.toLowerCase()) {
      case 'healthy stock':
        return '#4caf50';
      case 'low stock':
        return '#ff9800';
      case 'critical stock':
        return '#f44336';
      case 'out of stock':
        return '#9e9e9e';
      default:
        return '#2196f3';
    }
  }

  return (
    <div style={{ width: '100%', height: 400 }}>
      {data.length > 0 ? (
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center p-4">No data available</div>
      )}
    </div>
  );
};

export default StockLevelChart; 