import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { Form, Card, Badge, Spinner, ListGroup } from 'react-bootstrap';
import axiosInstance from '../utils/axios';
import { useDebounce } from 'use-debounce';
import { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types/api';

interface PartLocation {
  location: string;
  quantity: number;
}

interface Part {
  part_id: number;
  name: string;
  description: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  quantity: number;
  minimum_quantity: number;
  machine_id: number;
  supplier: string;
  unit_cost: string | number;
  locations: PartLocation[];
}

const PartSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => {
    const searchParts = async () => {
      if (!debouncedSearchTerm) {
        setParts([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get<Part[]>('/api/v1/parts');
        const filteredParts = response.data.filter(part => {
          const searchTermLower = debouncedSearchTerm.toLowerCase();
          const locationMatch = part.locations.some(loc => 
            loc.location.toLowerCase().includes(searchTermLower)
          );
          
          return (
            part.name.toLowerCase().includes(searchTermLower) ||
            part.description?.toLowerCase().includes(searchTermLower) ||
            part.manufacturer_part_number?.toLowerCase().includes(searchTermLower) ||
            part.fiserv_part_number?.toLowerCase().includes(searchTermLower) ||
            part.supplier?.toLowerCase().includes(searchTermLower) ||
            locationMatch
          );
        });
        setParts(filteredParts);
      } catch (err) {
        console.error('Error searching parts:', err);
        const error = err as AxiosError<ApiErrorResponse>;
        setError(error.response?.data?.error || error.response?.data?.message || 'Failed to search parts');
      } finally {
        setLoading(false);
      }
    };

    searchParts();
  }, [debouncedSearchTerm]);

  const getStockStatus = (quantity: number, minimum_quantity: number) => {
    if (quantity <= 0) {
      return <Badge bg="danger">Out of Stock</Badge>;
    } else if (quantity < minimum_quantity) {
      return <Badge bg="warning" text="dark">Low Stock</Badge>;
    }
    return <Badge bg="success">In Stock</Badge>;
  };

  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? '$0.00' : `$${numValue.toFixed(2)}`;
  };

  return (
    <div className="mb-4">
      <Form.Group className="mb-3">
        <Form.Label>Search Parts</Form.Label>
        <Form.Control
          type="text"
          placeholder="Search by name, part number, or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </Form.Group>

      {loading && (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )}

      {error && <div className="text-danger mb-3">{error}</div>}

      {!loading && !error && parts.length > 0 && (
        <ListGroup>
          {parts.map(part => (
            <ListGroup.Item key={part.part_id}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5>{part.name}</h5>
                  <p className="mb-1">{part.description}</p>
                  <small>
                    Part Numbers: {part.manufacturer_part_number} / {part.fiserv_part_number}
                  </small>
                  <div>
                    <strong>Locations: </strong>
                    {part.locations.map((loc, idx) => (
                      <span key={idx} className="me-2">
                        {loc.location} ({loc.quantity} units)
                        {idx < part.locations.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-end">
                  {getStockStatus(part.quantity, part.minimum_quantity)}
                  <div className="mt-2">
                    <strong>{formatCurrency(part.unit_cost)}</strong>
                  </div>
                </div>
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}

      {!loading && !error && searchTerm && parts.length === 0 && (
        <div className="text-muted">No parts found matching your search.</div>
      )}
    </div>
  );
};

export default PartSearch;
