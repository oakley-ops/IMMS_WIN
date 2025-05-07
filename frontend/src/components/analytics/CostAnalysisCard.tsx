import React from 'react';
import { Card, Table } from 'react-bootstrap';
import { CostAnalysis } from '../../services/analyticsService';

interface CostAnalysisCardProps {
  data: CostAnalysis;
}

const CostAnalysisCard: React.FC<CostAnalysisCardProps> = ({ data }) => {
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <h5 className="card-title">Cost Analysis</h5>
        
        <div className="d-flex justify-content-between mb-4 mt-3">
          <div className="text-center">
            <div className="text-muted small mb-1">Total Value</div>
            <h3 className="mb-0">{formatCurrency(data.total_inventory_value)}</h3>
          </div>
          <div className="text-center">
            <div className="text-muted small mb-1">Avg Part Cost</div>
            <h3 className="mb-0">{formatCurrency(data.average_part_cost)}</h3>
          </div>
        </div>
        
        <h6 className="mt-4 mb-2">Highest Value Parts</h6>
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Quantity</th>
              <th>Unit Cost</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            {data.highest_value_parts.map(part => (
              <tr key={part.part_id}>
                <td>{part.name}</td>
                <td>{part.quantity}</td>
                <td>{formatCurrency(part.unit_cost)}</td>
                <td>{formatCurrency(part.total_value)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default CostAnalysisCard; 