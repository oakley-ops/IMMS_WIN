import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import mockMachines from '../mockData/machines';

interface Machine {
  id?: number;
  machine_id?: number;
  name: string;
  model: string;
  serial_number: string;
  location?: string;
  manufacturer?: string;
  status?: string;
  installation_date?: string;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string;
  notes?: string;
}

interface Part {
  part_id: number;
  name: string;
  quantity: number;
  minimum_quantity: number;
  manufacturer_part_number: string;
  fiserv_part_number: string;
}

interface PartsUsage {
  part_id: number;
  part_name: string;
  fiserv_part_number: string;
  manufacturer_part_number: string;
  total_quantity_used: number;
  total_cost: number;
  usage_count: number;
  first_usage_date: string;
  last_usage_date: string;
}

interface TimelineData {
  month: string;
  monthly_cost: number;
  parts_count: number;
  parts_quantity: number;
}

const Machine: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [machine, setMachine] = useState<Machine | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [partsUsage, setPartsUsage] = useState<PartsUsage[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');
  const [totalPartsCost, setTotalPartsCost] = useState(0);

  useEffect(() => {
    if (!id || isNaN(parseInt(id))) {
      setError('Invalid machine ID');
      setLoading(false);
      return;
    }
    fetchMachineDetails();
  }, [id]);

  const fetchMachineDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // For development, use mock data instead of API call
      const foundMachine = mockMachines.find(m => 
        m.id === parseInt(id) || m.machine_id === parseInt(id)
      );
      
      if (!foundMachine) {
        throw new Error("Machine not found");
      }
      
      setMachine(foundMachine);
      
      // Mock empty parts for now
      setParts([]);
      setPartsUsage([]);
      
      // Mock timeline data
      const mockTimelineData = [
        { month: "Jan 2025", monthly_cost: 150, parts_count: 2, parts_quantity: 3 },
        { month: "Feb 2025", monthly_cost: 275, parts_count: 3, parts_quantity: 5 },
        { month: "Mar 2025", monthly_cost: 320, parts_count: 4, parts_quantity: 6 },
        { month: "Apr 2025", monthly_cost: 190, parts_count: 2, parts_quantity: 4 }
      ];
      
      setTimelineData(mockTimelineData);
      setTotalPartsCost(935); // Sum of the monthly costs in mock data
      
      // When ready to connect to real API, uncomment this:
      /*
      const [machineResponse, partsResponse, partsUsageResponse, timelineResponse] = await Promise.all([
        axios.get<Machine>(`${API_URL}/api/v1/machines/${id}`),
        axios.get<Part[]>(`${API_URL}/api/v1/machines/${id}/parts`),
        axios.get<PartsUsage[]>(`${API_URL}/api/v1/machines/${id}/parts-usage`),
        axios.get<TimelineData[]>(`${API_URL}/api/v1/machines/${id}/usage-timeline`)
      ]);
      
      setMachine(machineResponse.data);
      setParts(partsResponse.data);
      setPartsUsage(partsUsageResponse.data);
      
      // Format timeline data for chart
      const formattedTimelineData = timelineResponse.data.map((item: any) => ({
        ...item,
        month: new Date(item.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        monthly_cost: parseFloat(item.monthly_cost)
      }));
      setTimelineData(formattedTimelineData);
      
      // Calculate total parts cost
      const totalCost = partsUsageResponse.data.reduce((sum, item) => 
        sum + parseFloat(item.total_cost.toString()), 0);
      setTotalPartsCost(totalCost);
      */
      
      setError(null);
    } catch (error: any) {
      console.error('Error fetching machine details:', error);
      if (error.response?.status === 404 || error.message === "Machine not found") {
        setError('Machine not found');
      } else {
        setError(error.response?.data?.message || error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return '$0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `$${numValue.toFixed(2)}`;
  };

  const getDaysDifference = (date: string): number => {
    const now = new Date();
    const targetDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - targetDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isDateInPast = (date: string): boolean => {
    return new Date(date) < new Date();
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Loading machine details...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="mt-3">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
        <div className="d-flex justify-content-end">
          <Button variant="outline-danger" onClick={() => navigate('/machines')}>
            Back to Machines
          </Button>
        </div>
      </Alert>
    );
  }

  if (!machine) {
    return (
      <Alert variant="warning" className="mt-3">
        <Alert.Heading>No Data</Alert.Heading>
        <p>Machine information not available.</p>
        <div className="d-flex justify-content-end">
          <Button variant="outline-primary" onClick={() => navigate('/machines')}>
            Back to Machines
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <div>
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h3 className="mb-0">{machine.name}</h3>
          <div>
            <Button 
              variant="outline-primary" 
              className="me-2"
              onClick={() => navigate(`/machines/${machine.machine_id}/edit`)}
            >
              Edit
            </Button>
            <Button 
              variant="outline-secondary"
              onClick={() => navigate('/machines')}
            >
              Back
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k || 'details')}
            className="mb-3"
          >
            <Tab eventKey="details" title="Machine Details">
              <Table striped bordered hover>
                <tbody>
                  <tr>
                    <th>Machine ID</th>
                    <td>{machine.machine_id}</td>
                  </tr>
                  <tr>
                    <th>Model Number</th>
                    <td>{machine.model || 'N/A'}</td>
                  </tr>
                  <tr>
                    <th>Serial Number</th>
                    <td>{machine.serial_number || 'N/A'}</td>
                  </tr>
                  <tr>
                    <th>Manufacturer</th>
                    <td>{machine.manufacturer || 'N/A'}</td>
                  </tr>
                  <tr>
                    <th>Location</th>
                    <td>{machine.location || 'N/A'}</td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>
                      <Badge bg={machine.status === 'Active' ? 'success' : 'warning'}>
                        {machine.status || 'Unknown'}
                      </Badge>
                    </td>
                  </tr>
                  <tr>
                    <th>Installation Date</th>
                    <td>{formatDate(machine.installation_date)}</td>
                  </tr>
                  <tr>
                    <th>Last Maintenance</th>
                    <td>
                      {machine.last_maintenance_date ? (
                        <>
                          {formatDate(machine.last_maintenance_date)}
                          <Badge 
                            bg="info" 
                            className="ms-2"
                          >
                            {getDaysDifference(machine.last_maintenance_date)} days ago
                          </Badge>
                        </>
                      ) : 'N/A'}
                    </td>
                  </tr>
                  <tr>
                    <th>Next Maintenance</th>
                    <td>
                      {machine.next_maintenance_date ? (
                        <>
                          {formatDate(machine.next_maintenance_date)}
                          {!isDateInPast(machine.next_maintenance_date) ? (
                            <Badge 
                              bg="success" 
                              className="ms-2"
                            >
                              In {getDaysDifference(machine.next_maintenance_date)} days
                            </Badge>
                          ) : (
                            <Badge 
                              bg="danger" 
                              className="ms-2"
                            >
                              Overdue by {getDaysDifference(machine.next_maintenance_date)} days
                            </Badge>
                          )}
                        </>
                      ) : 'N/A'}
                    </td>
                  </tr>
                  {machine.notes && (
                    <tr>
                      <th>Notes</th>
                      <td>{machine.notes}</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Tab>
            
            <Tab eventKey="parts" title="Associated Parts">
              {parts.length === 0 ? (
                <Alert variant="info">No parts associated with this machine.</Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Part Name</th>
                      <th>Fiserv Part #</th>
                      <th>Manufacturer Part #</th>
                      <th>Current Quantity</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parts.map((part) => (
                      <tr key={part.part_id}>
                        <td>{part.name}</td>
                        <td>{part.fiserv_part_number}</td>
                        <td>{part.manufacturer_part_number}</td>
                        <td>{part.quantity}</td>
                        <td>
                          <Badge 
                            bg={
                              part.quantity === 0 
                                ? 'danger' 
                                : part.quantity <= part.minimum_quantity 
                                  ? 'warning' 
                                  : 'success'
                            }
                          >
                            {part.quantity === 0 
                              ? 'Out of Stock' 
                              : part.quantity <= part.minimum_quantity 
                                ? 'Low Stock' 
                                : 'In Stock'}
                          </Badge>
                        </td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => navigate(`/parts/${part.part_id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Tab>
            
            <Tab eventKey="usage" title="Parts Usage Cost">
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5>Parts Usage Summary</h5>
                  <h5>Total Cost: <Badge bg="primary">{formatCurrency(totalPartsCost)}</Badge></h5>
                </div>
                
                {partsUsage.length === 0 ? (
                  <Alert variant="info">No parts usage history for this machine.</Alert>
                ) : (
                  <>
                    <Table striped bordered hover responsive>
                      <thead>
                        <tr>
                          <th>Part Name</th>
                          <th>Fiserv Part #</th>
                          <th>Total Quantity Used</th>
                          <th>Total Cost</th>
                          <th>Usage Count</th>
                          <th>Last Used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partsUsage.map((usage) => (
                          <tr key={usage.part_id}>
                            <td>{usage.part_name}</td>
                            <td>{usage.fiserv_part_number}</td>
                            <td>{usage.total_quantity_used}</td>
                            <td>{formatCurrency(usage.total_cost)}</td>
                            <td>{usage.usage_count}</td>
                            <td>{formatDate(usage.last_usage_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    
                    <h5 className="mt-4 mb-3">Monthly Cost Trend</h5>
                    {timelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                          <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                          <Tooltip formatter={(value) => typeof value === 'number' ? `$${value.toFixed(2)}` : value} />
                          <Legend />
                          <Bar yAxisId="left" dataKey="monthly_cost" name="Monthly Cost" fill="#8884d8" />
                          <Bar yAxisId="right" dataKey="parts_quantity" name="Parts Quantity" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Alert variant="info">No timeline data available.</Alert>
                    )}
                  </>
                )}
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Machine;