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
