import React, { useState } from 'react';
import { Button, Card, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';

interface InventoryStatus {
  diagnosticRun: string;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockParts: any[];
  outOfStockParts: any[];
  message: string;
}

const InventoryStatusCheck: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<InventoryStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Create a direct request to the active port (4000) with authentication
      const token = localStorage.getItem('token');
      const result = await axios.get('http://localhost:4000/api/v1/parts/low-stock', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      console.log('Low stock parts:', result.data);
      
      // Format the response to match our expected structure
      const formattedResult = {
        diagnosticRun: new Date().toISOString(),
        lowStockCount: result.data.length,
        outOfStockCount: result.data.filter((part: any) => part.quantity === 0).length,
        lowStockParts: result.data.filter((part: any) => part.quantity > 0),
        outOfStockParts: result.data.filter((part: any) => part.quantity === 0),
        message: result.data.length > 0 
          ? 'Retrieved inventory status data successfully.' 
          : 'No low stock or out of stock parts found.'
      };
      
      setStatus(formattedResult);
    } catch (err: any) {
      console.error('Error checking inventory status:', err);
      setError(err.message || 'Failed to check inventory status');
    } finally {
      setLoading(false);
    }
  };

  const updateParts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Example: Update a few parts to have low stock
      // You can adjust these IDs based on actual parts in your database
      const partsToUpdate = [
        { id: '1', quantity: 1, minimum_quantity: 5 },
        { id: '2', quantity: 0, minimum_quantity: 3 },
        { id: '3', quantity: 2, minimum_quantity: 10 }
      ];
      
      for (const part of partsToUpdate) {
        try {
          await axios.put(`http://localhost:4000/api/v1/parts/${part.id}`, {
            quantity: part.quantity,
            minimum_quantity: part.minimum_quantity
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
            }
          });
          console.log(`Updated part ${part.id} to quantity=${part.quantity}, min=${part.minimum_quantity}`);
        } catch (updateErr) {
          console.error(`Error updating part ${part.id}:`, updateErr);
        }
      }
      
      // Re-check status
      await checkStatus();
    } catch (err: any) {
      console.error('Error updating parts:', err);
      setError(err.message || 'Failed to update parts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-0 rounded-3 mb-4">
      <Card.Body className="p-4">
        <Card.Title className="d-flex justify-content-between align-items-center mb-4">
          <span>Inventory Status Diagnostic</span>
          <div>
            <Button 
              variant="outline-primary" 
              onClick={checkStatus}
              disabled={loading}
              className="me-2"
            >
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                  <span className="ms-2">Checking...</span>
                </>
              ) : 'Check Status'}
            </Button>
            <Button 
              variant="outline-warning" 
              onClick={updateParts}
              disabled={loading}
            >
              Set Test Low Stock
            </Button>
          </div>
        </Card.Title>

        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        {status && (
          <>
            <div className="d-flex justify-content-between mb-3">
              <div>
                <p className="mb-1"><strong>Diagnostic Run:</strong> {new Date(status.diagnosticRun).toLocaleString()}</p>
                <p className="mb-1"><strong>Low Stock Count:</strong> <span className="text-warning">{status.lowStockCount}</span></p>
                <p className="mb-1"><strong>Out of Stock Count:</strong> <span className="text-danger">{status.outOfStockCount}</span></p>
              </div>
              <div>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>
            </div>

            <Alert variant={status.lowStockCount > 0 || status.outOfStockCount > 0 ? "info" : "success"}>
              {status.message}
            </Alert>

            {showDetails && (
              <>
                {status.lowStockParts.length > 0 && (
                  <div className="mt-3">
                    <h6>Low Stock Parts</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Quantity</th>
                            <th>Minimum</th>
                            <th>Vendor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {status.lowStockParts.map(part => (
                            <tr key={part.part_id}>
                              <td>{part.part_id}</td>
                              <td>{part.name}</td>
                              <td>{part.quantity}</td>
                              <td>{part.minimum_quantity}</td>
                              <td>{part.vendor_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {status.outOfStockParts.length > 0 && (
                  <div className="mt-3">
                    <h6>Out of Stock Parts</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Quantity</th>
                            <th>Minimum</th>
                            <th>Vendor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {status.outOfStockParts.map(part => (
                            <tr key={part.part_id}>
                              <td>{part.part_id}</td>
                              <td>{part.name}</td>
                              <td>{part.quantity}</td>
                              <td>{part.minimum_quantity}</td>
                              <td>{part.vendor_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default InventoryStatusCheck;
