# IMMS Unified UI — Phase 2: Bootstrap → MUI Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Bootstrap CSS classes and react-bootstrap components from IMMS. Convert every page and component to pure MUI with `sx` prop styling. Delete custom wrapper components (`ImmsButton`, `DashboardCard`, `ModalPortal`) and custom CSS files.

**Architecture:** Two kinds of Bootstrap usage exist in this codebase: (1) `react-bootstrap` imported components (`Modal`, `Button`, `Form`, etc.), and (2) raw Bootstrap CSS class strings (`className="form-control"`, `className="modal-dialog"`, etc.). Both must be converted. **Phase 1 must be complete** before starting Phase 2 (theme tokens must exist).

**Tech Stack:** React 18, MUI v5 (`@mui/material`, `@mui/lab`), TypeScript. Remove `react-bootstrap`, `bootstrap`, `@types/react-bootstrap` packages.

---

## Conversion Patterns Reference

Use these patterns throughout Phase 2.

### Dialog Pattern
```tsx
// BEFORE (raw Bootstrap CSS)
<div className="modal-dialog modal-dialog-centered">
  <div className="modal-content">
    <div className="dialog-header"><h5>Title</h5></div>
    <div className="dialog-content">…</div>
    <div className="dialog-footer">
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" type="submit">Save</button>
    </div>
  </div>
</div>

// AFTER (MUI)
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>…</DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button variant="contained" color="primary" type="submit">Save</Button>
  </DialogActions>
</Dialog>
```

### TextField Pattern
```tsx
// BEFORE
<label className="form-label">Search Part</label>
<input type="text" className="form-control" value={v} onChange={…} />

// AFTER
import { TextField } from '@mui/material';
<TextField label="Search Part" fullWidth value={v} onChange={…} size="small" />
```

### Select Pattern
```tsx
// BEFORE
<select className="form-select" value={v} onChange={…}>
  <option value="">Choose…</option>
  <option value="a">A</option>
</select>

// AFTER
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
<FormControl fullWidth size="small">
  <InputLabel>Choose</InputLabel>
  <Select value={v} onChange={…} label="Choose">
    <MenuItem value=""><em>Choose…</em></MenuItem>
    <MenuItem value="a">A</MenuItem>
  </Select>
</FormControl>
```

### Status Chip Pattern
```tsx
// BEFORE
<span className="stock-status status-out">Out of Stock</span>
<span className="stock-status status-low">Low Stock</span>
<span className="stock-status status-in">In Stock</span>

// AFTER
import { Chip } from '@mui/material';
import { COLOR_ERROR_BG, COLOR_ERROR_TEXT, COLOR_WARNING_BG, COLOR_WARNING_TEXT, COLOR_SUCCESS_BG, COLOR_SUCCESS_TEXT } from '../../theme';

const stockChip = (qty: number, min: number) => {
  if (qty === 0) return <Chip label="Out of Stock" size="small" sx={{ bgcolor: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT }} />;
  if (qty <= min) return <Chip label="Low Stock" size="small" sx={{ bgcolor: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT }} />;
  return <Chip label="In Stock" size="small" sx={{ bgcolor: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT }} />;
};
```

### Grid Layout Pattern
```tsx
// BEFORE
<div className="row">
  <div className="col-md-6">…</div>
  <div className="col-md-6">…</div>
</div>

// AFTER
import Grid from '@mui/material/Grid';
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>…</Grid>
  <Grid item xs={12} md={6}>…</Grid>
</Grid>
```

### Card Pattern
```tsx
// BEFORE
<div className="card"><div className="card-body">…</div></div>

// AFTER
import { Card, CardContent } from '@mui/material';
<Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
  <CardContent>…</CardContent>
</Card>
```

### Tabs Pattern
```tsx
// BEFORE (react-bootstrap)
import { Tabs, Tab } from 'react-bootstrap';
<Tabs defaultActiveKey="overview">
  <Tab eventKey="overview" title="Overview">…</Tab>
</Tabs>

// AFTER (MUI)
import { Tabs, Tab, Box } from '@mui/material';
const [tab, setTab] = useState(0);
<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
  <Tabs value={tab} onChange={(_, v) => setTab(v)}>
    <Tab label="Overview" />
  </Tabs>
</Box>
<Box hidden={tab !== 0}>…</Box>
```

---

## File Map

| Action | File |
|--------|------|
| Modify | `frontend/package.json` |
| Delete | `frontend/src/components/ImmsButton.tsx` |
| Delete | `frontend/src/components/DashboardCard.tsx` |
| Delete | `frontend/src/components/ModalPortal.tsx` |
| Delete | `frontend/src/styles/RestockForm.css` |
| Delete | `frontend/src/styles/Dialog.css` |
| Modify | `frontend/src/pages/Dashboard.tsx` |
| Modify | `frontend/src/pages/Parts.tsx` |
| Modify | `frontend/src/components/PartsList.tsx` (and all Parts components) |
| Modify | `frontend/src/pages/PurchaseOrders.tsx` (and all PO components) |
| Modify | `frontend/src/pages/Transactions.tsx` |
| Modify | `frontend/src/pages/Machines.tsx` (and all Machine components) |
| Modify | `frontend/src/pages/WorkOrders.tsx`, `WorkOrderForm.tsx`, `WorkOrderDetail.tsx` |
| Modify | `frontend/src/components/PMChecklistManagement.tsx`, `PMChecklistDialog.tsx`, `PMCalendar.tsx` |
| Modify | `frontend/src/pages/DieTracker.tsx`, `DieDetail.tsx`, `DieReports.tsx` (and all Die components) |
| Modify | `frontend/src/components/projects/ProjectList.tsx`, `ProjectCreationWizard.tsx`, `ProjectTimeline.tsx` |
| Modify | `frontend/src/components/Contacts.tsx` |
| Modify | `frontend/src/components/TechnicianManagement.tsx` |
| Modify | `frontend/src/components/suppliers/SupplierManagement.tsx`, `SupplierPartsList.tsx` |
| Modify | `frontend/src/pages/KPIDashboard.tsx` |
| Modify | `frontend/src/pages/UserManagement.tsx` |
| Modify | `frontend/src/pages/Scanner.tsx` |

---

### Task 1: Remove Bootstrap Packages and Delete Wrappers

**Files:**
- Modify: `frontend/package.json`
- Delete: `frontend/src/components/ImmsButton.tsx`
- Delete: `frontend/src/components/DashboardCard.tsx`
- Delete: `frontend/src/components/ModalPortal.tsx`
- Delete: `frontend/src/styles/RestockForm.css`
- Delete: `frontend/src/styles/Dialog.css`

- [ ] **Step 1: Uninstall Bootstrap packages**

```bash
cd frontend && npm uninstall react-bootstrap bootstrap @types/react-bootstrap
```
Expected: packages removed from node_modules and package.json.

- [ ] **Step 2: Remove Bootstrap import from entry point**

In `frontend/src/index.tsx` (or `App.tsx`), find and delete any line like:
```typescript
import 'bootstrap/dist/css/bootstrap.min.css';
```

Run: `grep -r "bootstrap" frontend/src --include="*.ts" --include="*.tsx" -l`
Check each result and remove the import.

- [ ] **Step 3: Delete the wrapper files and CSS**

```bash
rm frontend/src/components/ImmsButton.tsx
rm frontend/src/components/DashboardCard.tsx
rm frontend/src/components/ModalPortal.tsx
rm frontend/src/styles/RestockForm.css
rm frontend/src/styles/Dialog.css
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Bootstrap packages and delete legacy wrapper components"
```

---

### Task 2: Dashboard Page

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Check what Dashboard currently imports and uses**

Read `frontend/src/pages/Dashboard.tsx`. Find:
- Any `import DashboardCard from` → replace usages with inline `<Card><CardContent>`
- Any Bootstrap classes (`className="col-"`, `className="card"`, etc.) → replace with MUI Grid + Card
- Any `ImmsButton` imports → replace with MUI `<Button variant="contained">`

- [ ] **Step 2: Convert Dashboard to MUI**

Replace layout structure. The Dashboard page wraps stat cards in a grid. Pattern:

```tsx
import { Box, Typography, Card, CardContent, Grid, Chip } from '@mui/material';
import { COLOR_ERROR_BG, COLOR_ERROR_TEXT } from '../theme';

// Stats section
<Box sx={{ mb: 3 }}>
  <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Dashboard</Typography>
  <Grid container spacing={2}>
    <Grid item xs={12} sm={6} md={3}>
      <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary">Total Parts</Typography>
          <Typography variant="h4" fontWeight={700}>{stats.totalParts}</Typography>
        </CardContent>
      </Card>
    </Grid>
    {/* repeat for each stat */}
  </Grid>
</Box>
```

Remove all imports of `DashboardCard`, replace with the inline Card pattern above.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS (no Dashboard-specific tests exist currently).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat(dashboard): replace DashboardCard wrapper with MUI Card components"
```

---

### Task 3: Parts Page and Components

This is the largest group. Work file by file.

**Files (convert each):**
- `frontend/src/components/RestockForm.tsx` — raw Bootstrap CSS → MUI Dialog + TextField
- `frontend/src/components/RemovePartForm.tsx`
- `frontend/src/components/ReturnPartsDialog.tsx`
- `frontend/src/components/PartsUsageDialog.tsx`
- `frontend/src/components/ImportPartsDialog.tsx`
- `frontend/src/components/CSVUploadForm.tsx`
- `frontend/src/components/AddPart.tsx`
- `frontend/src/components/PartForm.tsx`
- `frontend/src/components/EditPartForm.tsx`
- `frontend/src/components/RestockComponent.tsx`
- `frontend/src/components/PartSearch.tsx`
- `frontend/src/components/LowStockReport.tsx`
- `frontend/src/components/PartImageUpload.tsx`
- `frontend/src/components/ManagePartSuppliers.tsx`
- `frontend/src/pages/Parts.tsx`

- [ ] **Step 1: Convert `RestockForm.tsx`**

`RestockForm` uses raw Bootstrap CSS (`modal-dialog`, `form-control`, `btn`) and `ModalPortal`. Replace with MUI Dialog:

```tsx
import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Typography, Box, CircularProgress, Alert, Autocomplete
} from '@mui/material';
import { COLOR_ERROR_BG, COLOR_ERROR_TEXT, COLOR_WARNING_BG, COLOR_WARNING_TEXT, COLOR_SUCCESS_BG, COLOR_SUCCESS_TEXT } from '../theme';

// Keep all existing interfaces (Part, RestockFormProps) and all business logic
// (useEffect, searchParts, handleSubmit) UNCHANGED.
// Only replace the JSX return:

// getStockStatus becomes:
const getStockStatus = (part: Part) => {
  if (part.quantity === 0)
    return <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: COLOR_ERROR_TEXT, bgcolor: COLOR_ERROR_BG, px: 1, py: 0.25, borderRadius: 1 }}>Out of Stock</Typography>;
  if (part.quantity <= part.minimum_quantity)
    return <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: COLOR_WARNING_TEXT, bgcolor: COLOR_WARNING_BG, px: 1, py: 0.25, borderRadius: 1 }}>Low Stock</Typography>;
  return <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, color: COLOR_SUCCESS_TEXT, bgcolor: COLOR_SUCCESS_BG, px: 1, py: 0.25, borderRadius: 1 }}>In Stock</Typography>;
};

// Replace return statement:
return (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>Restock Parts</DialogTitle>
    <form onSubmit={handleSubmit}>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          label="Search Part"
          fullWidth
          size="small"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            searchParts(e.target.value);
          }}
          sx={{ mb: 2 }}
          InputProps={{ endAdornment: searchLoading ? <CircularProgress size={16} /> : null }}
        />
        {parts.length > 0 && !selectedPart && (
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 2, maxHeight: 200, overflow: 'auto' }}>
            {parts.map((part) => (
              <Box
                key={part.part_id}
                onClick={() => { setSelectedPart(part); setSearchTerm(part.name); setParts([]); }}
                sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="body2" fontWeight={500}>{part.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{part.manufacturer_part_number}</Typography>
                  {getStockStatus(part)}
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {selectedPart && (
          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
            <Typography variant="body2" fontWeight={600}>{selectedPart.name}</Typography>
            <Typography variant="caption" color="text.secondary">Current qty: {selectedPart.quantity}</Typography>
          </Box>
        )}
        <TextField
          label="Quantity to Add"
          type="number"
          fullWidth
          size="small"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          inputProps={{ min: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" type="submit" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Restock'}
        </Button>
      </DialogActions>
    </form>
  </Dialog>
);
```

Remove imports: `'../styles/RestockForm.css'`, `'../styles/Dialog.css'`, `'./ModalPortal'`.

- [ ] **Step 2: Convert remaining Parts dialog components**

For each file in the list, follow the same pattern:
1. Remove `import ModalPortal` and any CSS file imports
2. Replace the wrapper `<div className="modal-dialog…">` with `<Dialog open={open} onClose={onClose}>`
3. Replace `<div className="dialog-header">` with `<DialogTitle>`
4. Replace `<div className="dialog-content">` with `<DialogContent>`
5. Replace `<div className="dialog-footer">` with `<DialogActions>`
6. Replace `<input className="form-control">` with `<TextField>`
7. Replace `<select className="form-select">` with `<FormControl><Select>`
8. Replace `<button className="btn btn-primary">` with `<Button variant="contained" color="primary">`
9. Replace `<button className="btn btn-secondary">` with `<Button>`

Apply to: `RemovePartForm.tsx`, `ReturnPartsDialog.tsx`, `PartsUsageDialog.tsx`, `ImportPartsDialog.tsx`, `CSVUploadForm.tsx`, `AddPart.tsx`, `PartForm.tsx`, `EditPartForm.tsx`, `RestockComponent.tsx`, `PartSearch.tsx`, `LowStockReport.tsx`, `PartImageUpload.tsx`, `ManagePartSuppliers.tsx`

- [ ] **Step 3: Convert `frontend/src/pages/Parts.tsx`**

Replace any Bootstrap grid classes with MUI Grid. Replace any Bootstrap Tabs with MUI Tabs. Replace page layout wrappers:

```tsx
// BEFORE
<div className="container-fluid">
  <div className="row mb-3">

// AFTER  
<Box sx={{ p: 0 }}>
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
```

- [ ] **Step 4: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RestockForm.tsx frontend/src/components/RemovePartForm.tsx \
  frontend/src/components/ReturnPartsDialog.tsx frontend/src/components/PartsUsageDialog.tsx \
  frontend/src/components/ImportPartsDialog.tsx frontend/src/components/CSVUploadForm.tsx \
  frontend/src/components/AddPart.tsx frontend/src/components/PartForm.tsx \
  frontend/src/components/EditPartForm.tsx frontend/src/components/RestockComponent.tsx \
  frontend/src/components/PartSearch.tsx frontend/src/components/LowStockReport.tsx \
  frontend/src/components/PartImageUpload.tsx frontend/src/components/ManagePartSuppliers.tsx \
  frontend/src/pages/Parts.tsx
git commit -m "feat(parts): convert all Parts components from Bootstrap to MUI"
```

---

### Task 4: Purchase Orders Page and Components

**Files:**
- `frontend/src/pages/PurchaseOrders.tsx`
- `frontend/src/components/purchaseOrders/PurchaseOrderList.tsx`
- `frontend/src/components/purchaseOrders/PurchaseOrderDetail.tsx`
- `frontend/src/components/purchaseOrders/ManualPOForm.tsx`
- `frontend/src/components/purchaseOrders/ManualPOEntryDialog.tsx`
- `frontend/src/components/purchaseOrders/GeneratePurchaseOrders.tsx`
- `frontend/src/components/purchaseOrders/POStatusCard.tsx`
- `frontend/src/components/purchaseOrders/PODocumentsList.tsx`
- `frontend/src/components/purchaseOrders/SimplePODocuments.tsx`
- `frontend/src/components/purchaseOrders/UploadPODocument.tsx`
- `frontend/src/components/purchaseOrders/POImportDialog.tsx`

- [ ] **Step 1: Convert each PO component**

For each file, follow the same Bootstrap → MUI pattern from the reference section. Key conversions for PO components:

`POStatusCard.tsx` — replace card className with MUI Card + status Chip:
```tsx
<Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Box>
      <Typography variant="overline" color="text.secondary">PO Number</Typography>
      <Typography variant="h6" fontWeight={700}>{po.po_number}</Typography>
    </Box>
    <Chip
      label={po.status}
      size="small"
      sx={{
        bgcolor: po.status === 'Received' ? COLOR_SUCCESS_BG : po.status === 'Pending' ? COLOR_WARNING_BG : COLOR_ERROR_BG,
        color: po.status === 'Received' ? COLOR_SUCCESS_TEXT : po.status === 'Pending' ? COLOR_WARNING_TEXT : COLOR_ERROR_TEXT,
      }}
    />
  </CardContent>
</Card>
```

`ManualPOForm.tsx` — convert form fields using TextField, FormControl, Select pattern from reference.

`POImportDialog.tsx`, `ManualPOEntryDialog.tsx` — use Dialog pattern from reference.

`UploadPODocument.tsx` — replace Bootstrap file input with:
```tsx
<Button variant="outlined" component="label">
  Upload Document
  <input type="file" hidden accept=".pdf,.doc,.docx" onChange={handleFileChange} />
</Button>
```

- [ ] **Step 2: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PurchaseOrders.tsx frontend/src/components/purchaseOrders/
git commit -m "feat(purchase-orders): convert PO components from Bootstrap to MUI"
```

---

### Task 5: Transactions and Machines

**Files:**
- `frontend/src/pages/Transactions.tsx`
- `frontend/src/components/TransactionHistory.tsx`
- `frontend/src/components/PartsUsageHistory.tsx`
- `frontend/src/pages/Machines.tsx`
- `frontend/src/components/MachineList.tsx`
- `frontend/src/components/Machine.tsx`
- `frontend/src/components/MachineForm.tsx`
- `frontend/src/components/EditMachineForm.tsx`
- `frontend/src/components/MachineDialogs.tsx`
- `frontend/src/components/MachineDocuments.tsx`
- `frontend/src/components/MachineCategories.tsx`
- `frontend/src/components/MachineCostReport.tsx`
- `frontend/src/components/AssignPartToMachineForm.tsx`

- [ ] **Step 1: Convert Transactions components**

`TransactionHistory.tsx` and `PartsUsageHistory.tsx` are currently DataGrid-based — leave the DataGrid intact for now (Phase 3 handles tables). Only convert any Bootstrap dialog/form/layout wrapping those components.

`Transactions.tsx` page — convert any Bootstrap layout/tabs to MUI.

- [ ] **Step 2: Convert Machine components**

`MachineForm.tsx` and `EditMachineForm.tsx` — convert all `<input className="form-control">` and `<select className="form-select">` to `<TextField>` and `<FormControl><Select>`.

`MachineDialogs.tsx` — convert Modal to Dialog using the Dialog pattern.

`AssignPartToMachineForm.tsx` — Dialog pattern + TextField for search.

`MachineCostReport.tsx` — replace Bootstrap table/card layout with MUI equivalents.

`MachineCategories.tsx` — replace Bootstrap list/card with MUI List or Card components.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Transactions.tsx frontend/src/pages/Machines.tsx \
  frontend/src/components/TransactionHistory.tsx frontend/src/components/PartsUsageHistory.tsx \
  frontend/src/components/MachineList.tsx frontend/src/components/Machine.tsx \
  frontend/src/components/MachineForm.tsx frontend/src/components/EditMachineForm.tsx \
  frontend/src/components/MachineDialogs.tsx frontend/src/components/MachineDocuments.tsx \
  frontend/src/components/MachineCategories.tsx frontend/src/components/MachineCostReport.tsx \
  frontend/src/components/AssignPartToMachineForm.tsx
git commit -m "feat(machines): convert Transactions + Machine components from Bootstrap to MUI"
```

---

### Task 6: Work Orders and PM Management

**Files:**
- `frontend/src/pages/WorkOrders.tsx`
- `frontend/src/pages/WorkOrderForm.tsx`
- `frontend/src/pages/WorkOrderDetail.tsx`
- `frontend/src/components/PMChecklistManagement.tsx`
- `frontend/src/components/PMChecklistDialog.tsx`
- `frontend/src/components/PMCalendar.tsx`

- [ ] **Step 1: Convert Work Order pages**

`WorkOrderForm.tsx` — convert all form fields (TextField, Select, DatePicker already using MUI x-date-pickers). Remove any Bootstrap form wrappers.

`WorkOrderDetail.tsx` — convert any Bootstrap tabs to MUI Tabs pattern:
```tsx
const [activeTab, setActiveTab] = useState(0);
<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
  <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
    <Tab label="Details" />
    <Tab label="Parts Used" />
    <Tab label="Notes" />
  </Tabs>
</Box>
<Box hidden={activeTab !== 0}>…details content…</Box>
<Box hidden={activeTab !== 1}>…parts content…</Box>
<Box hidden={activeTab !== 2}>…notes content…</Box>
```

`WorkOrders.tsx` — convert layout and any filter forms.

- [ ] **Step 2: Convert PM Management components**

`PMChecklistDialog.tsx` — use Dialog pattern. Form fields use TextField/Checkbox/Select.

`PMChecklistManagement.tsx` — replace Bootstrap layout with MUI Box/Grid/Card.

`PMCalendar.tsx` — `react-big-calendar` styles are separate from Bootstrap; leave calendar component as-is. Only convert surrounding layout/dialogs to MUI.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/WorkOrders.tsx frontend/src/pages/WorkOrderForm.tsx \
  frontend/src/pages/WorkOrderDetail.tsx frontend/src/components/PMChecklistManagement.tsx \
  frontend/src/components/PMChecklistDialog.tsx frontend/src/components/PMCalendar.tsx
git commit -m "feat(work-orders): convert Work Orders and PM Management from Bootstrap to MUI"
```

---

### Task 7: Die Management (Largest Group)

**Files:**
- `frontend/src/pages/DieTracker.tsx`
- `frontend/src/pages/DieDetail.tsx`
- `frontend/src/pages/DieReports.tsx`
- `frontend/src/components/dies/DieInventoryList.tsx`
- `frontend/src/components/dies/AddEditDieDialog.tsx`
- `frontend/src/components/dies/DieChangeDialog.tsx`
- `frontend/src/components/dies/ShipReceiveDialog.tsx`
- `frontend/src/components/dies/DocumentUploadDialog.tsx`
- `frontend/src/components/dies/ScheduleSharpeningDialog.tsx`
- `frontend/src/components/dies/SharpeningQueueList.tsx`
- `frontend/src/components/dies/SharpeningDetailDialog.tsx`
- `frontend/src/components/dies/detail/DieOverviewTab.tsx`
- `frontend/src/components/dies/detail/DieHistoryTab.tsx`
- `frontend/src/components/dies/detail/DieDocumentsTab.tsx`
- `frontend/src/components/dies/detail/DieSharpeningHistoryTab.tsx`
- `frontend/src/components/dies/reports/CostAnalysisReport.tsx`
- `frontend/src/components/dies/reports/DieUsageReport.tsx`
- `frontend/src/components/dies/reports/PredictiveMaintenanceReport.tsx`
- `frontend/src/components/dieInteractive/DiePressCard.tsx`
- `frontend/src/components/dieInteractive/DieShelf.tsx`
- `frontend/src/components/dieInteractive/DieChip.tsx`
- `frontend/src/components/dieInteractive/DullDieZone.tsx`
- `frontend/src/components/dieInteractive/SharpeningZone.tsx`
- `frontend/src/components/dieInteractive/SharpeningConfirmDialog.tsx`
- `frontend/src/components/dieInteractive/RemovalReasonDialog.tsx`
- `frontend/src/components/dies/DieBarcodeScanner.tsx`

- [ ] **Step 1: Convert all Die Dialog components**

Apply Dialog pattern to every file ending in `Dialog.tsx`:
- `AddEditDieDialog.tsx`, `DieChangeDialog.tsx`, `ShipReceiveDialog.tsx`, `DocumentUploadDialog.tsx`, `ScheduleSharpeningDialog.tsx`, `SharpeningDetailDialog.tsx`, `SharpeningConfirmDialog.tsx`, `RemovalReasonDialog.tsx`

Each: remove Bootstrap modal/form classes, replace with MUI Dialog + TextField/Select/Button.

- [ ] **Step 2: Convert Die detail tab components**

`DieDetail.tsx` — convert Bootstrap tabs to MUI Tabs (same pattern as WorkOrderDetail):
```tsx
const [activeTab, setActiveTab] = useState(0);
<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
  <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
    <Tab label="Overview" />
    <Tab label="History" />
    <Tab label="Documents" />
    <Tab label="Sharpening History" />
  </Tabs>
</Box>
```

Each tab content component (`DieOverviewTab`, `DieHistoryTab`, `DieDocumentsTab`, `DieSharpeningHistoryTab`) — convert Bootstrap card/table/form patterns to MUI equivalents.

- [ ] **Step 3: Convert interactive die board components**

`DiePressCard.tsx`, `DieShelf.tsx`, `DieChip.tsx`, `DullDieZone.tsx`, `SharpeningZone.tsx` — these use drag-and-drop (`@dnd-kit`) and likely have custom styling. Convert any Bootstrap `className` usage to `sx` props. Preserve all drag-and-drop logic entirely.

Die status chip pattern for `DieChip.tsx`:
```tsx
<Chip
  label={die.status}
  size="small"
  sx={{
    bgcolor: die.status === 'Active' ? COLOR_SUCCESS_BG : die.status === 'Sharpening' ? COLOR_WARNING_BG : COLOR_ERROR_BG,
    color: die.status === 'Active' ? COLOR_SUCCESS_TEXT : die.status === 'Sharpening' ? COLOR_WARNING_TEXT : COLOR_ERROR_TEXT,
    fontWeight: 600,
  }}
/>
```

- [ ] **Step 4: Convert Die reports**

`CostAnalysisReport.tsx`, `DieUsageReport.tsx`, `PredictiveMaintenanceReport.tsx` — replace Bootstrap card/table layout with MUI Card/Table/Grid.

- [ ] **Step 5: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DieTracker.tsx frontend/src/pages/DieDetail.tsx \
  frontend/src/pages/DieReports.tsx frontend/src/components/dies/ \
  frontend/src/components/dieInteractive/
git commit -m "feat(dies): convert Die Management from Bootstrap to MUI"
```

---

### Task 8: Projects, Contacts, Technicians, Suppliers

**Files:**
- `frontend/src/components/projects/ProjectList.tsx`
- `frontend/src/components/projects/ProjectCreationWizard.tsx`
- `frontend/src/components/projects/ProjectTimeline.tsx`
- `frontend/src/components/Contacts.tsx`
- `frontend/src/components/TechnicianManagement.tsx`
- `frontend/src/components/vendors/VendorList.tsx`
- `frontend/src/components/suppliers/SupplierManagement.tsx`
- `frontend/src/components/suppliers/SupplierPartsList.tsx`

- [ ] **Step 1: Convert Project components**

`ProjectCreationWizard.tsx` — uses a multi-step form. Convert each step's Bootstrap inputs to MUI TextField/Select. The stepper:
```tsx
import { Stepper, Step, StepLabel } from '@mui/material';
<Stepper activeStep={step} sx={{ mb: 3 }}>
  <Step><StepLabel>Basic Info</StepLabel></Step>
  <Step><StepLabel>Team</StepLabel></Step>
  <Step><StepLabel>Timeline</StepLabel></Step>
</Stepper>
```

`ProjectTimeline.tsx` — convert layout to MUI Box/Card. Preserve any timeline-specific logic.

`ProjectList.tsx` — convert Bootstrap table/card list to MUI Card grid or leave for Phase 3 table migration.

- [ ] **Step 2: Convert Contacts, Technicians, Suppliers**

`Contacts.tsx` — convert dialog and form to MUI Dialog + TextField.
`TechnicianManagement.tsx` — convert CRUD dialogs and forms to MUI.
`SupplierManagement.tsx` / `SupplierPartsList.tsx` — convert dialogs and forms.
`VendorList.tsx` — convert layout.

- [ ] **Step 3: Run tests**

```bash
cd frontend && npm test -- --watchAll=false 2>&1 | tail -20
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/projects/ frontend/src/components/Contacts.tsx \
  frontend/src/components/TechnicianManagement.tsx frontend/src/components/vendors/ \
  frontend/src/components/suppliers/
git commit -m "feat(management): convert Projects, Contacts, Technicians, Suppliers to MUI"
```

---

### Task 9: KPI Dashboard, User Management, Scanner, Remaining Pages

**Files:**
- `frontend/src/pages/KPIDashboard.tsx`
- `frontend/src/pages/UserManagement.tsx`
- `frontend/src/pages/Scanner.tsx`
- `frontend/src/pages/Unauthorized.tsx`
- `frontend/src/components/NotificationCenter.tsx`
- `frontend/src/components/BarcodeScanner.tsx`

- [ ] **Step 1: Convert KPI Dashboard**

`KPIDashboard.tsx` — convert Bootstrap grid layout around charts to MUI Grid. Charts (recharts/chart.js) stay as-is. Wrap each chart in:
```tsx
<Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', mb: 2 }}>
  <CardContent>
    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Chart Title</Typography>
    {/* chart component unchanged */}
  </CardContent>
</Card>
```

- [ ] **Step 2: Convert User Management**

`UserManagement.tsx` — convert Bootstrap table/dialog/form to MUI. Form inputs use TextField/Select/Switch for role toggles.

- [ ] **Step 3: Convert Scanner and remaining pages**

`Scanner.tsx` — scanner component (html5-qrcode/zxing) stays as-is. Convert surrounding layout/buttons/result display to MUI.

`Unauthorized.tsx` — simple page, replace any Bootstrap classes with MUI Typography/Button/Box.

`NotificationCenter.tsx`, `BarcodeScanner.tsx` — convert any Bootstrap classes to MUI.

- [ ] **Step 4: Run full test suite**

```bash
cd frontend && npm test -- --watchAll=false
```
Expected: all tests PASS.

- [ ] **Step 5: Final Bootstrap sweep — confirm zero remaining imports**

```bash
grep -r "react-bootstrap\|className=\"col-\|className=\"row\|className=\"form-control\|className=\"btn \|className=\"modal\|className=\"card\|import.*bootstrap" frontend/src --include="*.tsx" --include="*.ts"
```
Expected: zero results.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/KPIDashboard.tsx frontend/src/pages/UserManagement.tsx \
  frontend/src/pages/Scanner.tsx frontend/src/pages/Unauthorized.tsx \
  frontend/src/components/NotificationCenter.tsx frontend/src/components/BarcodeScanner.tsx
git commit -m "feat(pages): convert remaining pages to MUI — KPI, UserMgmt, Scanner"
```

- [ ] **Step 7: Tag Phase 2 complete**

```bash
git commit --allow-empty -m "chore: Phase 2 complete — Bootstrap fully removed, all components use MUI"
```
