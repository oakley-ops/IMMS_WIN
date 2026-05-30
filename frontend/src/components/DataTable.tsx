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
  // Server-side mode: the parent owns filtering/sorting/pagination. The rows
  // passed in are already the current page; DataTable only emits intent.
  serverMode?: boolean;
  rowCount?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onSearchChange?: (search: string) => void;
  onSortChange?: (key: keyof T, dir: SortDir) => void;
  rowSx?: (row: T) => Record<string, any>;
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
  serverMode = false,
  rowCount,
  page: pageProp,
  onPageChange,
  onSearchChange,
  onSortChange,
  rowSx,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [internalPage, setInternalPage] = useState(1);

  const page = pageProp ?? internalPage;

  const filtered = useMemo(() => {
    if (serverMode || !search) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row as object).some((v) =>
        String(v ?? '').toLowerCase().includes(q)
      )
    );
  }, [rows, search, serverMode]);

  const sorted = useMemo(() => {
    if (serverMode || !sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, serverMode]);

  // In server mode the rows passed in are already the current page; total count
  // comes from the server. Client mode counts the in-memory rows.
  const totalCount = serverMode ? (rowCount ?? sorted.length) : sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paged = serverMode || !pagination ? sorted : sorted.slice((page - 1) * pageSize, page * pageSize);

  const setPage = (next: number) => {
    if (pageProp === undefined) setInternalPage(next);
    onPageChange?.(next);
  };

  const handleSort = (key: keyof T) => {
    const nextDir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(nextDir);
    setPage(1);
    if (serverMode) onSortChange?.(key, nextDir);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    if (serverMode) onSearchChange?.(v);
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
                    ...(rowSx ? rowSx(row) : {}),
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

      {pagination && totalCount > pageSize && (
        <Box
          sx={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
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
