# Barcode Scanner Integration Plan for Die Tracker

**Status:** Implementation Plan  
**Date:** 2024

---

## 🎯 Overview

Integrate barcode scanning capabilities into the Die Tracker system to enable:
- Quick die lookup by scanning barcodes
- Faster install/remove workflows
- Inventory management via scanning
- Mobile-friendly scanning interface
- Barcode generation for dies

---

## 📋 Current State

### ✅ Already Available
- `BarcodeScanner` component (using `html5-qrcode` library)
- `barcode` field in `dies` table with unique index
- `qr_code_path` field for QR code storage
- Scanner page for parts (`/scanner`)
- Parts barcode lookup endpoint (`/api/v1/parts/barcode/:barcode`)

### ❌ Missing for Die Tracker
- Die barcode lookup endpoint
- Material-UI version of scanner (current uses Bootstrap)
- Integration into Die Tracker components
- Quick scan functionality
- Barcode generation/printing
- Install/Remove workflow integration

---

## 🏗️ Implementation Plan

### Phase 1: Backend API Enhancement

#### 1.1 Add Die Barcode Lookup Endpoint
**File:** `backend/src/routes/dies.js`

```javascript
// GET /api/v1/dies/barcode/:barcode
router.get('/barcode/:barcode', auth, async (req, res) => {
  // Lookup die by barcode
  // Return die details or 404
});
```

**Features:**
- Lookup by barcode (exact match)
- Return full die details
- Include machine and location info
- Handle not found gracefully

#### 1.2 Add Die Number Lookup (Alternative)
```javascript
// GET /api/v1/dies/number/:dieNumber
router.get('/number/:dieNumber', auth, async (req, res) => {
  // Lookup by die_number (DIE-YYYY-###)
});
```

---

### Phase 2: Frontend Scanner Component

#### 2.1 Create Material-UI Barcode Scanner
**File:** `frontend/src/components/dies/DieBarcodeScanner.tsx`

**Features:**
- Material-UI styling (matches Die Tracker theme)
- Camera permission handling
- Auto-stop after successful scan
- Error handling and user feedback
- Mobile-optimized view
- Supports both barcode and QR code formats

#### 2.2 Enhance Existing Scanner
**Option:** Update `BarcodeScanner.tsx` to support Material-UI theme

---

### Phase 3: Die Tracker Integration

#### 3.1 Quick Scan Button in Die Inventory
**Location:** `DieInventoryList.tsx` toolbar

**Features:**
- "Scan Barcode" button with camera icon
- Opens scanner dialog/modal
- On scan success:
  - Navigate to die detail page
  - OR highlight die in list
  - OR open quick actions menu

#### 3.2 Search Bar Enhancement
**Location:** `DieInventoryList.tsx` search field

**Features:**
- Barcode icon button in search field
- Click to open scanner
- Auto-populate search with scanned barcode
- Auto-search on scan

#### 3.3 Install/Remove Dialog Integration
**Location:** `DieChangeDialog.tsx`

**Features:**
- "Scan Die" button in dialog
- Pre-fill die selection from scan
- Validate die is available for action
- Show die details after scan

---

### Phase 4: Dedicated Scanner Page

#### 4.1 Die Scanner Page
**File:** `frontend/src/pages/DieScanner.tsx`

**Features:**
- Full-page scanner interface
- Die lookup and display
- Quick actions (View Details, Install, Remove)
- Scan history
- Mobile-optimized layout

**Route:** `/die-tracker/scan`

---

### Phase 5: Barcode Generation

#### 5.1 Barcode Generation Utility
**File:** `backend/src/utils/barcodeGenerator.js`

**Features:**
- Generate barcode images (Code 128, Code 39)
- Generate QR codes (containing die_number or die_id)
- Store QR code images
- Return barcode/QR code data URLs

#### 5.2 Barcode Display in UI
**Location:** Die Detail page, Die Inventory

**Features:**
- Display barcode image
- Display QR code
- Print barcode labels
- Download barcode image

#### 5.3 Auto-Generate on Die Creation
**Feature:** Auto-generate barcode/QR code when die is created if not provided

---

### Phase 6: Advanced Features

#### 6.1 Batch Scanning
- Scan multiple dies at once
- Bulk operations (install, remove, update)

#### 6.2 Physical Scanner Support
- USB barcode scanner support (keyboard wedge)
- Serial port scanner support
- Bluetooth scanner support

#### 6.3 Mobile App Integration
- React Native scanner component
- Offline scanning capability
- Sync when online

---

## 🔧 Technical Implementation Details

### Scanner Library
- **Current:** `html5-qrcode` (v2.3.8)
- **Supports:** QR codes, EAN, UPC, Code 128, Code 39
- **Platform:** Web browser camera API

### Barcode Format Options
1. **Die Number Format:** `DIE-YYYY-###` (human-readable)
2. **Barcode Value:** Can be:
   - Die number (DIE-2024-001)
   - Unique barcode (auto-generated or manual)
   - Die ID (numeric, less user-friendly)

### QR Code Content
- **Option 1:** Die number (`DIE-2024-001`)
- **Option 2:** JSON object: `{"type":"die","id":123,"number":"DIE-2024-001"}`
- **Option 3:** URL: `https://yourdomain.com/die-tracker/detail/123`

### Storage
- Barcode: Stored as text in `dies.barcode`
- QR Code: Image file stored in `dies.qr_code_path`
- File location: `/uploads/die_barcodes/die-{id}.png`

---

## 📱 User Workflows

### Workflow 1: Quick Die Lookup
1. User clicks "Scan Barcode" in Die Tracker
2. Scanner opens (camera activates)
3. User scans die barcode
4. System looks up die
5. Navigate to die detail page

### Workflow 2: Install Die via Scan
1. User clicks "Install" on a die
2. Install dialog opens
3. User clicks "Scan Die" button
4. Scanner opens
5. User scans die barcode
6. Die is auto-selected
7. User completes installation

### Workflow 3: Inventory Check
1. User navigates to Die Scanner page
2. Scans multiple dies
3. System shows status of each die
4. User can take actions on scanned dies

### Workflow 4: Generate Barcode Labels
1. User views die detail page
2. Clicks "Print Barcode Label"
3. System generates barcode/QR code
4. User prints label
5. Label affixed to physical die

---

## 🎨 UI/UX Considerations

### Scanner Interface
- Full-screen modal for scanning
- Clear instructions
- Visual feedback on successful scan
- Error messages for failed scans
- Permission request handling

### Mobile Optimization
- Responsive scanner view
- Touch-friendly controls
- Camera orientation handling
- Battery usage optimization

### Accessibility
- Keyboard shortcuts
- Screen reader support
- High contrast mode
- Alternative input methods

---

## 🔒 Security & Permissions

### Camera Permissions
- Request camera access on scanner open
- Handle permission denial gracefully
- Show instructions for enabling permissions

### API Security
- All endpoints require authentication
- Rate limiting on barcode lookup
- Audit logging of scan activities

---

## 📊 Database Considerations

### Indexes
- ✅ `idx_dies_barcode` already exists
- Consider composite index for barcode + status

### Performance
- Barcode lookup should be fast (< 50ms)
- Consider caching frequently scanned dies

---

## 🧪 Testing Plan

### Unit Tests
- Barcode lookup endpoint
- Scanner component rendering
- Error handling

### Integration Tests
- End-to-end scan workflow
- Install/remove via scan
- Mobile device testing

### User Acceptance Testing
- Real-world scanning scenarios
- Different barcode formats
- Various lighting conditions

---

## 📦 Dependencies

### Existing
- `html5-qrcode`: ^2.3.8 (already installed)

### New (Optional)
- `qrcode`: For QR code generation
- `jsbarcode`: For barcode image generation
- `react-qr-code`: Alternative QR code component

---

## 🚀 Implementation Priority

### High Priority (MVP)
1. ✅ Backend barcode lookup endpoint
2. ✅ Material-UI scanner component
3. ✅ Quick scan button in Die Inventory
4. ✅ Scanner integration in Install/Remove dialogs

### Medium Priority
5. Dedicated scanner page
6. Barcode generation utility
7. QR code display in UI

### Low Priority
8. Batch scanning
9. Physical scanner support
10. Mobile app integration

---

## 📝 Files to Create/Modify

### Backend
- `backend/src/routes/dies.js` (add barcode endpoint)
- `backend/src/utils/barcodeGenerator.js` (new)

### Frontend
- `frontend/src/components/dies/DieBarcodeScanner.tsx` (new)
- `frontend/src/pages/DieScanner.tsx` (new)
- `frontend/src/components/dies/DieInventoryList.tsx` (modify)
- `frontend/src/components/dies/DieChangeDialog.tsx` (modify)
- `frontend/src/pages/DieTracker.tsx` (modify - add scan route)
- `frontend/src/App.tsx` (modify - add scanner route)

---

## ✅ Success Criteria

1. User can scan a die barcode and view die details
2. User can install/remove dies via barcode scan
3. Scanner works on mobile devices
4. Barcode generation works for new dies
5. Performance is acceptable (< 2s for scan + lookup)

---

## 🔄 Future Enhancements

- NFC tag support
- RFID integration
- Voice feedback for hands-free operation
- Offline scanning with sync
- Analytics on scan usage
- Multi-language support

---

**Next Steps:** Begin with Phase 1 (Backend API) and Phase 2 (Frontend Scanner Component)

