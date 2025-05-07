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

interface TopUsedPartData {
  name: string;
  quantity: number;
}

interface TopUsedPartsChartProps {
  data: TopUsedPartData[];
}

const TopUsedPartsChart: React.FC<TopUsedPartsChartProps> = ({ data = [] }) => {
  const colors = {
    quantity: '#2196f3'
  };
  
  // Guard against undefined data
  if (!data) {
    return <div className="text-center p-4">No usage data available</div>;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <p style={{ margin: '0 0 5px', fontWeight: 'bold' }}>{label}</p>
        <p style={{ margin: '0', color: colors.quantity }}>
          Quantity Used: {payload[0].value}
        </p>
      </div>
    );
  };

  return (
    <div style={{ width: '100%', height: 400 }}>
      {data && data.length > 0 ? (
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={70}
              interval={0}
            />
            <YAxis 
              label={{ value: 'Quantity Used', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="quantity"
              name="Quantity Used"
              fill={colors.quantity}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center p-4">No usage data available</div>
      )}
    </div>
  );
};

export default TopUsedPartsChart; 