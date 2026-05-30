import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable, { ColumnDef } from '../DataTable';

interface Row { id: number; name: string; qty: number; }

const columns: ColumnDef<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'qty',  label: 'Quantity', align: 'right' },
];

const rows: Row[] = [
  { id: 1, name: 'Bearing', qty: 10 },
  { id: 2, name: 'Gasket',  qty: 3  },
  { id: 3, name: 'Shaft',   qty: 7  },
];

describe('DataTable', () => {
  test('renders column headers', () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
  });

  test('renders row data', () => {
    render(<DataTable columns={columns} rows={rows} />);
    expect(screen.getByText('Bearing')).toBeInTheDocument();
    expect(screen.getByText('Gasket')).toBeInTheDocument();
  });

  test('filters rows when searchable and search input is used', () => {
    render(<DataTable columns={columns} rows={rows} searchable searchPlaceholder="Search..." />);
    const input = screen.getByPlaceholderText('Search...');
    fireEvent.change(input, { target: { value: 'Gear' } });
    expect(screen.queryByText('Bearing')).not.toBeInTheDocument();
  });

  test('sorts rows ascending on column header click', () => {
    render(<DataTable columns={columns} rows={rows} />);
    fireEvent.click(screen.getByText('Name'));
    const cells = screen.getAllByRole('cell').filter(c => ['Bearing','Gasket','Shaft'].includes(c.textContent ?? ''));
    expect(cells[0].textContent).toBe('Bearing');
    expect(cells[1].textContent).toBe('Gasket');
    expect(cells[2].textContent).toBe('Shaft');
  });

  test('sorts rows descending on second column header click', () => {
    render(<DataTable columns={columns} rows={rows} />);
    fireEvent.click(screen.getByText('Name'));
    fireEvent.click(screen.getByText('Name'));
    const cells = screen.getAllByRole('cell').filter(c => ['Bearing','Gasket','Shaft'].includes(c.textContent ?? ''));
    expect(cells[0].textContent).toBe('Shaft');
  });

  test('calls onRowClick when a row is clicked', () => {
    const onRowClick = jest.fn();
    render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Bearing'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  test('renders custom toolbar', () => {
    render(<DataTable columns={columns} rows={rows} toolbar={<button>Add</button>} />);
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  test('shows empty state when no rows', () => {
    render(<DataTable columns={columns} rows={[]} emptyMessage="No parts found" />);
    expect(screen.getByText('No parts found')).toBeInTheDocument();
  });

  test('paginates rows — shows only pageSize rows', () => {
    const manyRows = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Part ${i}`, qty: i }));
    render(<DataTable columns={columns} rows={manyRows} pageSize={10} />);
    expect(screen.getByText('Part 0')).toBeInTheDocument();
    expect(screen.queryByText('Part 10')).not.toBeInTheDocument();
  });

  test('renders custom cell content via render prop', () => {
    const cols: ColumnDef<Row>[] = [
      { key: 'name', label: 'Name' },
      { key: 'qty', label: 'Status', render: (row) => <span data-testid="status">{row.qty > 5 ? 'OK' : 'Low'}</span> },
    ];
    render(<DataTable columns={cols} rows={rows} />);
    expect(screen.getAllByTestId('status')[0]).toHaveTextContent('OK');
    expect(screen.getAllByTestId('status')[1]).toHaveTextContent('Low');
  });

  describe('server mode', () => {
    test('does not filter rows client-side; emits onSearchChange', () => {
      const onSearchChange = jest.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          serverMode
          searchable
          searchPlaceholder="Search..."
          onSearchChange={onSearchChange}
        />
      );
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.change(input, { target: { value: 'Gear' } });
      // Rows stay as-is — the server owns filtering
      expect(screen.getByText('Bearing')).toBeInTheDocument();
      expect(onSearchChange).toHaveBeenCalledWith('Gear');
    });

    test('does not sort rows client-side; emits onSortChange', () => {
      const onSortChange = jest.fn();
      render(
        <DataTable columns={columns} rows={rows} serverMode onSortChange={onSortChange} />
      );
      fireEvent.click(screen.getByText('Name'));
      expect(onSortChange).toHaveBeenCalledWith('name', 'asc');
      // Order is unchanged — server returns sorted rows
      const cells = screen.getAllByRole('cell').filter(c => ['Bearing','Gasket','Shaft'].includes(c.textContent ?? ''));
      expect(cells[0].textContent).toBe('Bearing');
    });

    test('derives pagination from rowCount and emits onPageChange', () => {
      const onPageChange = jest.fn();
      render(
        <DataTable
          columns={columns}
          rows={rows}
          serverMode
          rowCount={50}
          pageSize={10}
          page={1}
          onPageChange={onPageChange}
        />
      );
      // 50 rows / 10 per page = 5 pages
      expect(screen.getByText('1–10 of 50')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Go to page 3'));
      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    test('renders all passed rows in server mode regardless of pageSize', () => {
      render(
        <DataTable columns={columns} rows={rows} serverMode rowCount={100} pageSize={2} page={1} />
      );
      // Server already paged; DataTable must not slice further
      expect(screen.getByText('Bearing')).toBeInTheDocument();
      expect(screen.getByText('Gasket')).toBeInTheDocument();
      expect(screen.getByText('Shaft')).toBeInTheDocument();
    });
  });
});
