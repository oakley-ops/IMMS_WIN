import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Container, Table, Form, Row, Col, Button } from 'react-bootstrap';

interface Transaction {
  transaction_id: number;
  part_id: number;
  part_name: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  machine_name: string;
  type: string;
  quantity: number;
  date: string;
  user_id: string;
  notes: string;
  reference_number: string;
  unit_cost: number;
}

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const fetchTransactions = async (start?: string, end?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (start) params.append('startDate', `${start}T00:00:00`);
      if (end) params.append('endDate', `${end}T23:59:59`);

      const response = await axios.get<Transaction[]>(`/api/v1/transactions?${params.toString()}`);
      console.log('Transactions:', response.data);
      setTransactions(response.data);
      setError('');
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      setError(error.response?.data?.details || error.response?.data?.error || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(startDate, endDate);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    fetchTransactions();
  };

  const handleExport = () => {
    // Convert transactions to CSV
    const headers = ['Date', 'Part', 'Fiserv Part #', 'Machine', 'Type', 'Quantity', 'User', 'Reference #', 'Notes', 'Unit Cost'];
    const csvData = transactions.map(t => [
      formatDate(t.date),
      t.part_name,
      t.fiserv_part_number,
      t.machine_name || 'N/A',
      t.type,
      t.quantity,
      t.user_id,
      t.reference_number || '',
      t.notes || '',
      t.unit_cost
    ]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `parts_usage_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <Container>Loading transactions...</Container>;
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Parts Usage History</h1>
        <Button variant="success" onClick={handleExport}>
          Export to Excel
        </Button>
      </div>
      
      <Form onSubmit={handleFilter} className="mb-4">
        <Row>
          <Col md={4}>
            <Form.Group>
              <Form.Label>Start Date</Form.Label>
              <Form.Control
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label>End Date</Form.Label>
              <Form.Control
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={4} className="d-flex align-items-end">
            <Button type="submit" variant="primary" className="me-2">
              Filter
            </Button>
            <Button variant="secondary" onClick={handleReset}>
              Reset
            </Button>
          </Col>
        </Row>
      </Form>

      {error && <div className="alert alert-danger">{error}</div>}

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Date</th>
            <th>Part</th>
            <th>Fiserv Part #</th>
            <th>Machine</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>User</th>
            <th>Reference #</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center">No transactions found</td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <tr key={transaction.transaction_id}>
                <td>{formatDate(transaction.date)}</td>
                <td>{transaction.part_name}</td>
                <td>{transaction.fiserv_part_number}</td>
                <td>{transaction.machine_name || 'N/A'}</td>
                <td>{transaction.type}</td>
                <td>{transaction.quantity}</td>
                <td>{transaction.user_id}</td>
                <td>{transaction.reference_number || ''}</td>
                <td>{transaction.notes || ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Container>
  );
};

export default Transactions;
