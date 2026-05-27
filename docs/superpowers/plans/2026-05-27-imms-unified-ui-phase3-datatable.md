# IMMS Unified UI — Phase 3: DataGrid → MUI Table

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `@mui/x-data-grid` with a reusable `DataTable` component built on MUI Table primitives. Migrate all list/grid views to use it. Remove the DataGrid dependency.

**Architecture:** Build one shared `DataTable<T>` component that handles sorting, pagination, search, and custom cell rendering via a `columns` prop. All list pages consume this component. DataGrid is removed after all consumers are migrated.

**Tech Stack:** React 18, MUI v5 (`@mui/material`), TypeScript generics. Phases 1 and 2 must be complete first.

---

## File Map

| Action | File |
|--------|------|
| Create | `frontend/src/components/DataTable.tsx` |
| Create | `frontend/src/components/__tests__/DataTable.test.tsx` |
| Modify | `frontend/src/components/PartsList.tsx` |
| Modify | `frontend/src/components/purchaseOrders/PurchaseOrderList.tsx` |
| Modify | `frontend/src/components/TransactionHistory.tsx` |
| Modify | `frontend/src/components/PartsUsageHistory.tsx` |
| Modify | `frontend/src/components/MachineList.tsx` |
| Modify | `frontend/src/pages/WorkOrders.tsx` (list view) |
| Modify | `frontend/src/components/dies/DieInventoryList.tsx` |
| Modify | `frontend/src/components/dies/SharpeningQueueList.tsx` |
| Modify | `frontend/src/components/Contacts.tsx` (list view) |
| Modify | `frontend/src/components/TechnicianManagement.tsx` (list view) |
| Modify | `frontend/package.json` |

---

### Task 1: Build the DataTable Component (TDD)

**Files:**
- Create: `frontend/src/components/__tests__/DataTable.test.tsx`
- Create: `frontend/src/components/DataTable.tsx`

- [ ] **Step 1: Write failing tests first**

```typescript
// frontend/src/components/__tests__/DataTable.test.tsx
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
});
```

- [ ] **Step 2: Run tests — confirm all fail (component doesn't exist yet)**

```bash
cd frontend && npm test -- --testPathPattern="DataTable" --watchAll=false
```
Expected: FAIL with "Cannot find module '../DataTable'".

- [ ] **Step 3: Implement `DataTable.tsx`**

```typescript
// frontend/src/components/DataTable.tsx
import React, { useState, useMemo } from 'react';
import {
  Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Box, TextField, Typography,
  TableSortLabel, InputAdornment, Pagination,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { PRIMARY_ORANGE } from '../theme';

export interface ColumnDef<T> {
  key: keyof T;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: number | string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  pagination?: boolean;
}

type SortDir = 'asc' | 'desc';

export default function DataTable<T extends { id: number | string }>({
  columns,
  rows,
  pageSize = 25,
  searchable = false,
  searchPlaceholder = 'Search…',
  onRowClick,
  toolbar,
  emptyMessage = 'No results found.',
  pagination = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row as object).some((v) =>
        String(v ?? '').toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = pagination ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  return (
    <Paper sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <Box
          sx={{
            px: 2, py: 1.5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid', borderColor: 'divider',
          }}
        >
          {searchable ? (
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 280 }}
            />
          ) : <Box />}
          {toolbar && <Box>{toolbar}</Box>}
        </Box>
      )}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#FAFAFA' }}>
              {columns.map((col) => (
                <TableCell
                  key={String(col.key)}
                  align={col.align ?? 'left'}
                  sx={{
                    fontWeight: 600,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'text.secondary',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                    py: 1.5,
                  }}
                >
                  {col.sortable !== false ? (
                    <TableSortLabel
                      active={sortKey === col.key}
                      direction={sortKey === col.key ? sortDir : 'asc'}
                      onClick={() => handleSort(col.key)}
                      sx={{ '&.Mui-active': { color: PRIMARY_ORANGE } }}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    '&:hover': { bgcolor: `rgba(255,107,53,0.04)` },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={String(col.key)}
                      align={col.align ?? 'left'}
                      sx={{ py: 1.25, fontSize: 14 }}
                    >
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination && sorted.length > pageSize && (
        <Box
          sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </Typography>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            sx={{
              '& .MuiPaginationItem-root.Mui-selected': {
                bgcolor: PRIMARY_ORANGE,
                color: 'white',
                '&:hover': { bgcolor: PRIMARY_ORANGE, opacity: 0.9 },
              },
            }}
          />
        </Box>
      )}
    </Paper>
  );
}
```

- [ ] **Step 4: Run DataTable tests — confirm all pass**

```bash
cd frontend && npm test -- --testPathPattern="DataTable" --watchAll=false
```
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DataTable.tsx frontend/src/components/__tests__/DataTable.test.tsx
git commit -m "feat(DataTable): build reusable MUI Table component with sort/search/pagination"
```

---

### Task 2: Migrate PartsList

**Files:**
- Modify: `frontend/src/components/PartsList.tsx`

- [ ] **Step 1: Read the current PartsList to identify DataGrid columns and row structure**

Open `frontend/src/components/PartsList.tsx`. Find the `columns` array passed to `<DataGrid>`. Note each `field`, `headerName`, and any `renderCell` functions.

- [ ] **Step 2: Replace DataGrid with DataTable**

Convert the DataGrid column definitions to `ColumnDef<Part>[]`:

```tsx
import DataTable, { ColumnDef } from './DataTable';
import { Chip, Box } from '@mui/material';
import { COLOR_ERROR_BG, COLOR_ERROR_TEXT, COLOR_WARNING_BG, COLOR_WARNING_TEXT, COLOR_SUCCESS_BG, COLOR_SUCCESS_TEXT } from '../theme';

interface Part {
  id: number;
  crc_part_number: string;
  name: string;
  quantity: number;
  minimum_quantity: number;
  location?: string;
  manufacturer_part_number?: string;
}

const stockChip = (row: Part) => {
  if (row.quantity === 0)
    return <Chip label="Out of Stock" size="small" sx={{ bgcolor: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT }} />;
  if (row.quantity <= row.minimum_quantity)
    return <Chip label="Low Stock" size="small" sx={{ bgcolor: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT }} />;
  return <Chip label="In Stock" size="small" sx={{ bgcolor: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT }} />;
};

const columns: ColumnDef<Part>[] = [
  { key: 'crc_part_number', label: 'Part Number' },
  { key: 'name', label: 'Description' },
  { key: 'quantity', label: 'Qty', align: 'center' },
  { key: 'minimum_quantity', label: 'Min', align: 'center' },
  { key: 'location', label: 'Location' },
  {
    key: 'quantity',
    label: 'Status',
    align: 'center',
    sortable: false,
    render: stockChip,
  },
];

// In JSX:
<DataTable
  columns={columns}
  rows={parts}
  searchable
  searchPlaceholder="Search parts…"
  onRowClick={(part) => navigate(`/parts/${part.id}`)}
  toolbar={
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="contained" color="primary" onClick={handleAddPart}>+ Add Part</Button>
    </Box>
  }
  emptyMessage="No parts found."
/>
```

Remove `@mui/x-data-grid` import from this file.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PartsList.tsx
git commit -m "feat(parts): replace DataGrid with DataTable in PartsList"
```

---

### Task 3: Migrate PurchaseOrderList and TransactionHistory

**Files:**
- Modify: `frontend/src/components/purchaseOrders/PurchaseOrderList.tsx`
- Modify: `frontend/src/components/TransactionHistory.tsx`
- Modify: `frontend/src/components/PartsUsageHistory.tsx`

- [ ] **Step 1: Convert PurchaseOrderList**

Read the current DataGrid columns from `PurchaseOrderList.tsx`. Convert to `ColumnDef<PurchaseOrder>[]`:

```tsx
import DataTable, { ColumnDef } from '../DataTable';
import { Chip } from '@mui/material';

const poStatusChip = (row: PurchaseOrder) => {
  const map: Record<string, { bg: string; text: string }> = {
    'Pending':   { bg: COLOR_WARNING_BG, text: COLOR_WARNING_TEXT },
    'Ordered':   { bg: '#E3F2FD', text: '#1565C0' },
    'Received':  { bg: COLOR_SUCCESS_BG, text: COLOR_SUCCESS_TEXT },
    'Cancelled': { bg: COLOR_ERROR_BG, text: COLOR_ERROR_TEXT },
  };
  const s = map[row.status] ?? { bg: '#F5F5F5', text: '#666' };
  return <Chip label={row.status} size="small" sx={{ bgcolor: s.bg, color: s.text }} />;
};

const columns: ColumnDef<PurchaseOrder>[] = [
  { key: 'po_number', label: 'PO Number' },
  { key: 'vendor_name', label: 'Vendor' },
  { key: 'order_date', label: 'Order Date' },
  { key: 'total_amount', label: 'Total', align: 'right', render: (row) => `$${row.total_amount?.toFixed(2) ?? '0.00'}` },
  { key: 'status', label: 'Status', align: 'center', sortable: false, render: poStatusChip },
];

<DataTable
  columns={columns}
  rows={purchaseOrders}
  searchable
  searchPlaceholder="Search purchase orders…"
  onRowClick={(po) => navigate(`/purchase-orders/${po.id}`)}
  toolbar={<Button variant="contained" color="primary" onClick={handleCreate}>+ New PO</Button>}
/>
```

- [ ] **Step 2: Convert TransactionHistory and PartsUsageHistory**

Same pattern. Read existing DataGrid columns and recreate as `ColumnDef[]` with appropriate render functions for dates and amounts.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/purchaseOrders/PurchaseOrderList.tsx \
  frontend/src/components/TransactionHistory.tsx \
  frontend/src/components/PartsUsageHistory.tsx
git commit -m "feat(tables): migrate PO list and Transaction history to DataTable"
```

---

### Task 4: Migrate MachineList, WorkOrders, and Die Lists

**Files:**
- Modify: `frontend/src/components/MachineList.tsx`
- Modify: `frontend/src/pages/WorkOrders.tsx`
- Modify: `frontend/src/components/dies/DieInventoryList.tsx`
- Modify: `frontend/src/components/dies/SharpeningQueueList.tsx`

- [ ] **Step 1: Convert MachineList**

Read existing DataGrid columns from `MachineList.tsx`. Convert to DataTable. Machine status chip:
```tsx
const machineStatusChip = (row: Machine) => {
  const map: Record<string, { bg: string; text: string }> = {
    'Active':      { bg: COLOR_SUCCESS_BG, text: COLOR_SUCCESS_TEXT },
    'Maintenance': { bg: COLOR_WARNING_BG, text: COLOR_WARNING_TEXT },
    'Offline':     { bg: COLOR_ERROR_BG, text: COLOR_ERROR_TEXT },
  };
  const s = map[row.status] ?? { bg: '#F5F5F5', text: '#666' };
  return <Chip label={row.status} size="small" sx={{ bgcolor: s.bg, color: s.text }} />;
};
```

- [ ] **Step 2: Convert WorkOrders list view**

`WorkOrders.tsx` — convert the list DataGrid to DataTable. Work order priority chip:
```tsx
const priorityChip = (row: WorkOrder) => {
  const map: Record<string, { bg: string; text: string }> = {
    'High':   { bg: COLOR_ERROR_BG, text: COLOR_ERROR_TEXT },
    'Medium': { bg: COLOR_WARNING_BG, text: COLOR_WARNING_TEXT },
    'Low':    { bg: COLOR_SUCCESS_BG, text: COLOR_SUCCESS_TEXT },
  };
  const s = map[row.priority] ?? { bg: '#F5F5F5', text: '#666' };
  return <Chip label={row.priority} size="small" sx={{ bgcolor: s.bg, color: s.text }} />;
};
```

- [ ] **Step 3: Convert Die lists**

`DieInventoryList.tsx` and `SharpeningQueueList.tsx` — follow the same pattern. Die status chip uses `COLOR_SUCCESS`/`COLOR_WARNING`/`COLOR_ERROR` as appropriate for die states.

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MachineList.tsx frontend/src/pages/WorkOrders.tsx \
  frontend/src/components/dies/DieInventoryList.tsx \
  frontend/src/components/dies/SharpeningQueueList.tsx
git commit -m "feat(tables): migrate Machine, WorkOrder, and Die lists to DataTable"
```

---

### Task 5: Migrate Contacts and Technicians Lists; Remove DataGrid Package

**Files:**
- Modify: `frontend/src/components/Contacts.tsx` (list section)
- Modify: `frontend/src/components/TechnicianManagement.tsx` (list section)
- Modify: `frontend/package.json`

- [ ] **Step 1: Convert Contacts list section to DataTable**

```tsx
const columns: ColumnDef<Contact>[] = [
  { key: 'name', label: 'Name' },
  { key: 'company', label: 'Company' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
];

<DataTable
  columns={columns}
  rows={contacts}
  searchable
  searchPlaceholder="Search contacts…"
  onRowClick={(c) => setSelectedContact(c)}
  toolbar={<Button variant="contained" color="primary" onClick={handleAdd}>+ Add Contact</Button>}
/>
```

- [ ] **Step 2: Convert TechnicianManagement list to DataTable**

```tsx
const columns: ColumnDef<Technician>[] = [
  { key: 'name', label: 'Name' },
  { key: 'employee_id', label: 'Employee ID' },
  { key: 'department', label: 'Department' },
  { key: 'is_active', label: 'Active', align: 'center', render: (row) =>
    <Chip label={row.is_active ? 'Active' : 'Inactive'} size="small"
      sx={{ bgcolor: row.is_active ? COLOR_SUCCESS_BG : '#F5F5F5',
            color: row.is_active ? COLOR_SUCCESS_TEXT : '#666' }} />
  },
];
```

- [ ] **Step 3: Confirm zero DataGrid imports remain**

```bash
grep -r "x-data-grid\|DataGrid\|GridColDef\|GridRowsProp" frontend/src --include="*.tsx" --include="*.ts"
```
Expected: zero results.

- [ ] **Step 4: Uninstall DataGrid package**

```bash
cd frontend && npm uninstall @mui/x-data-grid
```

- [ ] **Step 5: Run full test suite**

```bash
cd frontend && npm test -- --watchAll=false
```
Expected: all tests PASS.

- [ ] **Step 6: Final commit — Phase 3 complete**

```bash
git add frontend/src/components/Contacts.tsx frontend/src/components/TechnicianManagement.tsx \
  frontend/package.json
git commit -m "feat(tables): migrate remaining lists to DataTable; remove @mui/x-data-grid"
git commit --allow-empty -m "chore: Phase 3 complete — unified DataTable across all IMMS list views"
```
