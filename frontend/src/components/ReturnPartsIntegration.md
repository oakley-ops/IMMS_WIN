# Return Parts Integration Guide

This guide explains how to integrate the return parts functionality into your existing components.

## Components Created

1. **ReturnPartsDialog** - Main dialog for returning parts to inventory
2. **ReturnPartButton** - Reusable button component that opens the return dialog

## Backend Changes

1. **Database Schema** - Added 'return' transaction type to transactions table
2. **API Endpoint** - Added `/api/v1/parts/return` endpoint
3. **Transaction History** - Updated to include return transactions

## Frontend Integration Examples

### 1. Adding Return Button to Parts List

```tsx
import ReturnPartButton from './ReturnPartButton';

// In your parts list component, add the return button alongside other actions
<ReturnPartButton 
  part={part} 
  onSuccess={refreshPartsList}
  size="small"
  variant="outlined"
/>
```

### 2. Adding Return Option to Existing Dialogs

```tsx
import ReturnPartsDialog from './ReturnPartsDialog';

// Add state for the return dialog
const [returnDialogOpen, setReturnDialogOpen] = useState(false);

// Add button to open return dialog
<Button 
  startIcon={<UndoIcon />}
  onClick={() => setReturnDialogOpen(true)}
  color="info"
>
  Return Parts
</Button>

// Add the dialog
<ReturnPartsDialog
  open={returnDialogOpen}
  onClose={() => setReturnDialogOpen(false)}
  onSuccess={handleReturnSuccess}
/>
```

### 3. Integration in Toolbar/Action Bar

```tsx
// In a main toolbar or action bar
<Box sx={{ display: 'flex', gap: 1 }}>
  <Button 
    startIcon={<AddIcon />} 
    onClick={openUsageDialog}
  >
    Use Parts
  </Button>
  <ReturnPartButton 
    onSuccess={refreshData}
    variant="contained"
    size="medium"
  />
</Box>
```

## Usage Flow

1. **Tech realizes part not needed** - After checking out a part, if the tech realizes it's not needed
2. **Click Return button** - Available in parts list, dialogs, or main navigation
3. **Select part and quantity** - Choose the part and how many units to return
4. **Provide reason** - Explain why the part is being returned (e.g., "Wrong part", "Job cancelled")
5. **Confirm return** - Part quantity is added back to inventory with proper transaction record

## Transaction Tracking

The system now properly tracks:
- **Usage transactions** - Parts taken from inventory (displayed with red minus sign)
- **Return transactions** - Parts returned to inventory (displayed with blue plus sign)
- **Restock transactions** - Parts added via purchase orders (displayed with green plus sign)

This provides accurate inventory tracking and resolves the issue where returned parts were incorrectly showing as used parts.

## Database Migration

Run the migration file to add return transaction support:
```sql
-- Run: backend/migrations/add_return_transaction_type.sql
```

This will update your existing database to support the new return functionality.
