import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { UsageTrend } from '../types';
import dayjs from 'dayjs';

interface UsageTrendChartProps {
  data: UsageTrend[];
}

const CustomTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        fill="#666"
        transform="rotate(-45)"
      >
        {payload.value}
      </text>
    </g>
  );
};

const UsageTrendChart: React.FC<UsageTrendChartProps> = ({ data }) => {
  console.log('UsageTrendChart received data:', data);

  const processedData = useMemo(() => {
    if (!data || data.length === 0) {
      console.log('No data provided to UsageTrendChart');
      return [];
    }

    // Group data by date
    const groupedByDate = data.reduce((acc, curr) => {
      if (!curr.date) {
        console.log('Entry missing date:', curr);
        return acc;
      }

      // Format the date key consistently
      const dateKey = dayjs(curr.date).format('YYYY-MM-DD');
      console.log('Processing entry:', { curr, dateKey });
      
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          totalUsage: 0,
          totalRestock: 0,
          parts: {}
        };
      }

      // Add usage and restock quantities
      acc[dateKey].totalUsage += Number(curr.usage_quantity) || 0;
      acc[dateKey].totalRestock += Number(curr.restock_quantity) || 0;

      // Track individual part usage
      if (curr.usage_quantity > 0 || curr.restock_quantity > 0) {
        if (!acc[dateKey].parts[curr.part_name]) {
          acc[dateKey].parts[curr.part_name] = {
            usage: 0,
            restock: 0
          };
        }
        acc[dateKey].parts[curr.part_name].usage += Number(curr.usage_quantity) || 0;
        acc[dateKey].parts[curr.part_name].restock += Number(curr.restock_quantity) || 0;
      }

      return acc;
    }, {} as Record<string, any>);

    console.log('Grouped data:', groupedByDate);

    // Convert to array and sort by date
    const processedArray = Object.values(groupedByDate)
      .map(day => ({
        ...day,
        date: dayjs(day.date).format('MMM D'),
        netChange: day.totalRestock - day.totalUsage
      }))
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());

    console.log('Final processed array:', processedArray);
    return processedArray;
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dayData = processedData.find(d => d.date === label);
    if (!dayData) return null;

    return (
      <div className="custom-tooltip" style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}>
        <p style={{ margin: '0 0 5px', fontWeight: 'bold' }}>{label}</p>
        <p style={{ margin: '0 0 5px', color: '#2196f3' }}>
          Usage: {dayData.totalUsage}
        </p>
        <p style={{ margin: '0 0 5px', color: '#4caf50' }}>
          Restock: {dayData.totalRestock}
        </p>
        <p style={{ margin: '0', color: '#9c27b0' }}>
          Net Change: {dayData.netChange}
        </p>
        {Object.entries(dayData.parts).map(([partName, data]: [string, any]) => (
          <div key={partName} style={{ marginTop: '5px', fontSize: '0.9em' }}>
            <p style={{ margin: '0', color: '#666' }}>
              {partName}:
              {data.usage > 0 && ` -${data.usage}`}
              {data.restock > 0 && ` +${data.restock}`}
            </p>
          </div>
        ))}
      </div>
    );
  };

  console.log('Rendering chart with processed data length:', processedData.length);

  return (
    <div style={{ width: '100%', height: 400 }}>
      {processedData.length > 0 ? (
        <ResponsiveContainer>
          <LineChart 
            data={processedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date"
              height={60}
              tick={<CustomTick />}
            />
            <YAxis 
              label={{ value: 'Quantity', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalUsage"
              stroke="#2196f3"
              name="Usage"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="totalRestock"
              stroke="#4caf50"
              name="Restock"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="netChange"
              stroke="#9c27b0"
              name="Net Change"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center p-4">No usage data available</div>
      )}
    </div>
  );
};

export default UsageTrendChart; 