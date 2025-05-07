import React, { useEffect, useState, useRef } from 'react';
import axiosInstance from '../services/axiosInstance';
import { DashboardData } from '../types/DashboardData';
import { LowStockReport } from '../components/LowStockReport';
import PMCalendar from '../components/PMCalendar';
import { PMCalendarRef } from '../types/PMCalendarRef';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const calendarRef = useRef<PMCalendarRef>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const handleDateChange = (date: Date) => {
    setCalendarDate(date);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axiosInstance.get<{ data: DashboardData }>('/api/v1/dashboard');
        setDashboardData(response.data.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch dashboard data');
        console.error('Error fetching dashboard data:', err);
      }
    };

    fetchDashboardData();
  }, []);

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
        <div className="mt-2">
          <button 
            className="btn btn-outline-danger"
            onClick={() => {
              setError(null);
              fetchDashboardData();
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container-fluid p-4">
      <div className="row g-4">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="card-title">Total Parts</h5>
              <p data-testid="total-parts" className="card-text display-6 mb-0 mt-auto text-primary">
                {dashboardData.totalParts || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="card-title">Low Stock Parts</h5>
              <p data-testid="low-stock-count" className="card-text display-6 mb-0 mt-auto text-warning">
                {dashboardData.lowStockCount || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body d-flex flex-column">
              <h5 className="card-title">Out of Stock Parts</h5>
              <p data-testid="out-of-stock-count" className="card-text display-6 mb-0 mt-auto text-danger">
                {dashboardData.outOfStockCount || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Low Stock Report</h5>
              <LowStockReport data={dashboardData.lowStockParts || []} />
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Recent Usage</h5>
              {dashboardData.recentUsage && dashboardData.recentUsage.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover" data-testid="low-stock-table">
                    <thead>
                      <tr>
                        <th>Part Name</th>
                        <th>Quantity Used</th>
                        <th>Date</th>
                        <th>Machine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentUsage.map((usage, index) => (
                        <tr key={index}>
                          <td data-testid={`low-stock-part-name-${usage.partName}`}>{usage.partName}</td>
                          <td>{usage.quantity}</td>
                          <td>{new Date(usage.date).toLocaleDateString()}</td>
                          <td>{usage.machine}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No recent usage data available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <PMCalendar
        ref={calendarRef}
        defaultDate={calendarDate}
        onDateChange={handleDateChange}
      />
    </div>
  );
};

export default Dashboard; 