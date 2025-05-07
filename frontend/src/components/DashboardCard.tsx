import React from 'react';

interface DashboardCardProps {
  title: string;
  value: number;
  variant?: 'primary' | 'warning' | 'danger';
  testId?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  value, 
  variant = 'primary',
  testId 
}) => {
  return (
    <div className="col-md-3 col-sm-6">
      <div className="card shadow-sm border-0 rounded-3 h-100">
        <div className="card-body d-flex flex-column p-3">
          <h6 className="card-subtitle mb-2 text-muted">{title}</h6>
          <p 
            className={`card-text display-6 mb-0 mt-auto ${variant ? `text-${variant}` : ''}`}
            data-testid={testId}
          >
            {value || 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard; 