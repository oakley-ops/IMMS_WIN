import React from 'react';
import { Card, Table } from 'react-bootstrap';
import { UsagePatterns } from '../../services/analyticsService';

interface UsagePatternsCardProps {
  data: UsagePatterns;
}

const UsagePatternsCard: React.FC<UsagePatternsCardProps> = ({ data }) => {
  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <h5 className="card-title">Usage Patterns</h5>
        
        <h6 className="mt-4 mb-2">Fastest Moving Parts</h6>
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Usage Trend</th>
              <th>Used (30d)</th>
            </tr>
          </thead>
          <tbody>
            {data.fastest_moving_parts.map(part => (
              <tr key={part.part_id}>
                <td>{part.name}</td>
                <td>{Math.abs(part.trend).toFixed(2)} units/day</td>
                <td>{part.usage_last_30_days} units</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="text-center text-muted mt-4">
          <p>Usage chart visualization will be available soon</p>
        </div>
      </Card.Body>
    </Card>
  );
};

export default UsagePatternsCard; 