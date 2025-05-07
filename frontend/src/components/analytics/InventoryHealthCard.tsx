import React from 'react';
import { Card, Table } from 'react-bootstrap';
import { InventoryHealth } from '../../services/analyticsService';

interface InventoryHealthCardProps {
  data: InventoryHealth;
}

const InventoryHealthCard: React.FC<InventoryHealthCardProps> = ({ data }) => {
  return (
    <Card className="shadow-sm h-100">
      <Card.Body>
        <h5 className="card-title">Inventory Health</h5>
        
        <div className="d-flex justify-content-between mb-4 mt-3">
          <div className="text-center">
            <div className="text-muted small mb-1">Turnover Rate</div>
            <h3 className="mb-0">{data.average_turnover_rate.toFixed(2)}</h3>
          </div>
          <div className="text-center">
            <div className="text-muted small mb-1">Stock Coverage</div>
            <h3 className="mb-0">{data.stock_coverage_days} days</h3>
          </div>
        </div>
        
        <h6 className="mt-4 mb-2">High Risk Parts</h6>
        <Table responsive size="sm">
          <thead>
            <tr>
              <th>Part Name</th>
              <th>Risk Score</th>
              <th>Days to Stockout</th>
            </tr>
          </thead>
          <tbody>
            {data.high_risk_parts.map(part => (
              <tr key={part.part_id}>
                <td>{part.name}</td>
                <td>{(part.risk_score * 100).toFixed(1)}%</td>
                <td>{part.days_until_stockout.toFixed(1)} days</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default InventoryHealthCard; 