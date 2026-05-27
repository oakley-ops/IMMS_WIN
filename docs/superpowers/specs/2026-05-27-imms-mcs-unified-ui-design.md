# IMMS → MCS Unified UI Design Spec

**Date:** 2026-05-27
**Goal:** Bring IMMS frontend UI/UX into full alignment with MCS design language so both apps feel like one product suite.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Direction | IMMS matches MCS |
| Navigation | Persistent mini sidebar (64px icons → 240px on hover) + dark top AppBar |
| Accent color | Orange `#FF6B35` (dropping IMMS blue `#0066A1`) |
| Component library | Full Bootstrap removal, pure MUI with `sx` prop |
| Tables | MUI Table replacing MUI DataGrid |
| Scope | All pages, all components |
| Approach | 3 phases, each shippable |

## Shared Design Tokens

Both IMMS and MCS will use these values:

| Token | Value | Usage |
|-------|-------|-------|
| `DARK_BG` | `#121212` | AppBar background |
| `DARK_SURFACE` | `#1E1E1E` | Sidebar background |
| `PRIMARY` / accent | `#FF6B35` | Active nav items, buttons, branding, links |
| `PAGE_BG` | `#F5F5F5` | Main content area background |
| `PAPER` | `#FFFFFF` | Cards, table containers |
| `ERROR` | `#EF5350` | Low stock, errors, critical status |
| `SUCCESS` | `#66BB6A` | In stock, resolved, completed |
| `WARNING` | `#FFA726` | In progress, pending |
| `TEXT_PRIMARY` | `#333333` | Headings, primary content |
| `TEXT_SECONDARY` | `#666666` | Supporting text, labels |
| `BORDER` | `#E0E0E0` | Table borders, dividers |

Typography: Roboto, button `textTransform: 'none'`, `fontWeight: 600` on buttons/chips, `fontWeight: 700` on headings.

## Phase 1 — Theme, Navigation & Layout

### 1.1 New Theme (`frontend/src/theme/index.ts`)

Replace the current IMMS_BLUE/IMMS_ORANGE theme with MCS-aligned tokens:
- `palette.primary.main` → `#FF6B35`
- `palette.background.default` → `#F5F5F5`
- `palette.background.paper` → `#FFFFFF`
- Export named constants: `DARK_BG`, `DARK_SURFACE`, `PRIMARY_ORANGE`, `PAGE_BG`
- Remove `IMMS_BLUE`, `IMMS_ORANGE` exports
- Remove `commonStyles` object (replaced by consistent `sx` patterns)
- Remove CSS custom properties from `index.css` (`:root` block with `--imms-*` variables)

### 1.2 New Navigation (`frontend/src/components/Navigation.tsx`)

Replace the current 240px persistent blue sidebar with:

**Top AppBar (fixed, 56px):**
- Background: `DARK_BG` (`#121212`)
- Left: app icon + "IMMS" in `PRIMARY_ORANGE`, bold
- Right: username in `grey.400`, "Sign Out" button
- `zIndex: theme.zIndex.drawer + 1` (above sidebar)

**Mini Sidebar (persistent, left):**
- Collapsed width: `64px` — icon-only, centered in 44×44px hit targets
- Expanded width: `240px` — triggered by hover (`onMouseEnter`/`onMouseLeave`)
- Background: `DARK_SURFACE` (`#1E1E1E`)
- Active item: `rgba(255, 107, 53, 0.15)` background, orange icon
- Inactive items: `#AAAAAA` icons, `#CCCCCC` text when expanded
- Hover on items: `rgba(255, 107, 53, 0.08)` background

**Grouped sections (visible when expanded):**
- **Inventory**: Dashboard, Parts, Purchase Orders, Transactions
- **Equipment**: Machines, Work Orders, PM Management, Die Management
- **Management**: Projects, Contacts, Technicians
- **External**: Maintenance System (with ↗ indicator)
- **Analytics**: KPI Dashboard (permission-gated)

Section dividers: `1px solid #333`. Section labels: `#666`, 11px, uppercase, `letter-spacing: 1px`.

**Content area offset:**
- `marginTop: '56px'` (below AppBar)
- `marginLeft: '64px'` (beside collapsed sidebar)
- Transition: content does NOT shift when sidebar expands (sidebar overlays)

### 1.3 CSS Cleanup

Remove from `frontend/src/index.css`:
- `:root` custom properties block (`--imms-blue`, `--imms-orange`, etc.)
- `.MuiDataGrid-*` custom overrides (removed in Phase 3)
- Bootstrap grid overrides
- Sidebar-specific styles

Keep: base resets, font imports, print styles if any.

### 1.4 Login Page

Update `frontend/src/pages/Login.tsx`:
- Background: `DARK_BG` or gradient from `#121212` to `#1E1E1E`
- Card: white with orange accent border-top
- "IMMS" branding in `PRIMARY_ORANGE`
- MUI TextField, MUI Button (orange)

## Phase 2 — Component Migration (Bootstrap → MUI)

### 2.1 Remove Bootstrap Dependency

- Uninstall `react-bootstrap` and `bootstrap` from `package.json`
- Remove `import 'bootstrap/dist/css/bootstrap.min.css'` from entry point
- Delete `frontend/src/styles/RestockForm.css`
- Delete `frontend/src/styles/Dialog.css`

### 2.2 Delete Custom Wrappers

- Delete `frontend/src/components/ImmsButton.tsx` → use `<Button variant="contained" color="primary">` from MUI
- Delete `frontend/src/components/DashboardCard.tsx` → use `<Card><CardContent>` from MUI
- Delete `frontend/src/components/ModalPortal.tsx` → use MUI `<Dialog>`

### 2.3 Component Mapping

Every Bootstrap component gets a MUI replacement:

| Bootstrap | MUI Replacement |
|-----------|-----------------|
| `<Modal>` | `<Dialog>` + `<DialogTitle>` + `<DialogContent>` + `<DialogActions>` |
| `<Form>`, `<Form.Group>`, `<Form.Control>` | `<TextField>`, `<FormControl>`, `<InputLabel>`, `<Select>` |
| `<Button>` (react-bootstrap) | `<Button>` (MUI) with `variant="contained"` or `variant="outlined"` |
| `<Card>`, `<Card.Body>` | `<Card>` + `<CardContent>` |
| `<Alert>` | `<Alert>` (MUI) |
| `<Badge>` | `<Chip>` |
| `<Table>` (bootstrap) | `<Table>` (MUI) — see Phase 3 |
| `<Tabs>`, `<Tab>` | `<Tabs>` + `<Tab>` (MUI) |
| `className="row"` / `className="col-md-*"` | `<Grid2 container>` + `<Grid2 size={{ xs, md }}>` |
| `className="d-flex"` | `<Box display="flex">` or `<Stack>` |
| `className="mb-3"` etc. | `sx={{ mb: 3 }}` |

### 2.4 Pages to Convert (all inner content)

Each page file and its associated components:

| Page | File | Key Components to Convert |
|------|------|--------------------------|
| Dashboard | `pages/Dashboard.tsx` | DashboardCard, grid layout, stats cards |
| Parts | `pages/Parts.tsx` | PartsList, PartForm, AddPart, EditPartForm, RestockForm, RestockComponent, RemovePartForm, ReturnPartsDialog, PartsUsageDialog, ImportPartsDialog, CSVUploadForm, PartSearch, LowStockReport, PartImageUpload, ManagePartSuppliers |
| Purchase Orders | `pages/PurchaseOrders.tsx` | PurchaseOrderList, PurchaseOrderDetail, ManualPOForm, ManualPOEntryDialog, GeneratePurchaseOrders, POStatusCard, PODocumentsList, SimplePODocuments, UploadPODocument, POImportDialog |
| Transactions | `pages/Transactions.tsx` | TransactionHistory, PartsUsageHistory |
| Machines | `pages/Machines.tsx` | MachineList, Machine, MachineForm, EditMachineForm, MachineDialogs, MachineDocuments, MachineCategories, MachineCostReport, AssignPartToMachineForm |
| Work Orders | `pages/WorkOrders.tsx`, `WorkOrderForm.tsx`, `WorkOrderDetail.tsx` | Work order forms and detail views |
| PM Management | components: `PMChecklistManagement.tsx`, `PMChecklistDialog.tsx`, `PMCalendar.tsx` | Checklists, calendar, dialogs |
| Die Management | `pages/DieTracker.tsx`, `DieDetail.tsx`, `DieReports.tsx` | DieInventoryList, AddEditDieDialog, DieChangeDialog, ShipReceiveDialog, DocumentUploadDialog, ScheduleSharpeningDialog, SharpeningQueueList, SharpeningDetailDialog, all detail tabs, all report components, all interactive components (DiePressCard, DieShelf, DieChip, DullDieZone, SharpeningZone, SharpeningConfirmDialog, RemovalReasonDialog) |
| Projects | components: `ProjectList.tsx`, `ProjectCreationWizard.tsx`, `ProjectTimeline.tsx` | Wizard, timeline, list |
| Contacts | `components/Contacts.tsx` | Contact list and forms |
| Technicians | `components/TechnicianManagement.tsx` | Technician CRUD |
| Suppliers | `components/suppliers/SupplierManagement.tsx`, `SupplierPartsList.tsx` | Supplier views |
| KPI Dashboard | `pages/KPIDashboard.tsx` | Analytics cards, charts |
| Login | `pages/Login.tsx` | Login form |
| Scanner | `pages/Scanner.tsx` | Barcode scanner UI |
| User Management | `pages/UserManagement.tsx` | User admin |

### 2.5 Styling Approach

All styling via MUI `sx` prop. No custom CSS files, no Bootstrap utility classes, no inline `style` objects.

Pattern for consistent card styling:
```tsx
<Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
  <CardContent>...</CardContent>
</Card>
```

Pattern for consistent dialog styling:
```tsx
<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>...</DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button variant="contained" color="primary">Confirm</Button>
  </DialogActions>
</Dialog>
```

### 2.6 Status Chips

Uniform status indicator pattern (matches MCS):
```tsx
<Chip
  label="In Stock"
  size="small"
  sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }}
/>
```

Status color mapping:
| Status | Background | Text |
|--------|-----------|------|
| In Stock / Resolved / Complete | `#E8F5E9` | `#2E7D32` |
| Low Stock / Critical / Overdue | `#FFEBEE` | `#C62828` |
| In Progress / Pending | `#FFF3E0` | `#E65100` |
| Out of Stock / Suspended | `#F3E5F5` | `#6A1B9A` |

## Phase 3 — Table Migration (DataGrid → MUI Table)

### 3.1 Remove DataGrid Dependency

- Uninstall `@mui/x-data-grid` from `package.json`
- Remove DataGrid CSS overrides from `index.css`

### 3.2 Reusable Table Component

Build a shared `DataTable` component using MUI Table primitives:

**Props:**
- `columns: { key, label, align?, render? }[]`
- `rows: T[]`
- `sortable?: boolean` (default true)
- `pagination?: boolean` (default true)
- `pageSize?: number` (default 25)
- `searchable?: boolean`
- `searchPlaceholder?: string`
- `onRowClick?: (row: T) => void`
- `toolbar?: ReactNode` (for action buttons like "+ Add Part")

**Features:**
- Column header click to sort (ascending/descending toggle)
- Client-side pagination with orange-accented page indicators
- Optional search bar in toolbar area
- Row hover highlight: `rgba(255, 107, 53, 0.04)`
- Header row: `#FAFAFA` background, uppercase 12px labels
- Responsive: horizontal scroll on small screens

### 3.3 Pages Using DataGrid (to convert)

- Parts list (`PartsList.tsx`)
- Purchase order list (`PurchaseOrderList.tsx`)
- Transaction history (`TransactionHistory.tsx`)
- Machine list (`MachineList.tsx`)
- Work orders list
- Die inventory list (`DieInventoryList.tsx`)
- Sharpening queue (`SharpeningQueueList.tsx`)
- Contact list
- Technician list
- Any other grid/list views

## Mobile / Responsive Behavior

- AppBar: hamburger icon replaces sidebar on screens < 768px
- Sidebar: becomes a temporary overlay drawer (MCS behavior) on mobile
- Tables: horizontal scroll wrapper
- Cards: stack vertically on small screens via MUI Grid2 breakpoints
- Dialogs: `fullScreen` on `xs` breakpoint

## Files NOT Changed

- Backend (no API changes)
- MCS frontend (already the target design)
- `maintenance_call_system/` directory (untouched)

## Success Criteria

1. IMMS navigation, colors, and chrome are indistinguishable in style from MCS
2. Zero Bootstrap imports remain in the codebase
3. All components use MUI with `sx` prop styling
4. All data tables use MUI Table with consistent sorting/pagination
5. Status indicators use Chip components with shared color mapping
6. Responsive behavior works on PC (localhost:3002) and Raspberry Pi (10.1.10.50:3001)
