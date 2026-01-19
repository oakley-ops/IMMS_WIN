# Die Tracking System - Comprehensive Implementation Plan

## Executive Summary
This document outlines a complete die tracking system for card punch machines that tracks die lifecycle, sharpening status, machine assignments, and change reasons. The system follows industry best practices for tool/die management and integrates seamlessly with your existing Fiserv Inventory Management System.

---

## Table of Contents
1. [Industry Best Practices Research](#industry-best-practices-research)
2. [System Requirements](#system-requirements)
3. [Die Lifecycle States & Workflows](#die-lifecycle-states--workflows)
4. [Database Schema Design](#database-schema-design)
5. [API Endpoints Specification](#api-endpoints-specification)
6. [User Interface Components](#user-interface-components)
7. [Integration Points](#integration-points)
8. [Implementation Phases](#implementation-phases)
9. [Testing & Validation](#testing--validation)

---

## Industry Best Practices Research

### Key Findings from Manufacturing Tool Management
Based on research from leading manufacturing operations, the following best practices apply to die tracking:

#### 1. **Real-Time Tool Tracking**
- Implement immediate status updates when dies are moved, changed, or serviced
- Use QR codes or barcodes for quick identification
- Track location at all times (in machine, in storage, out for sharpening)

#### 2. **Predictive Maintenance**
- Monitor die usage patterns and cycles
- Track sharpening frequency to predict when dies need service
- Maintain sharpening history to determine die end-of-life

#### 3. **Inventory Optimization**
- Maintain minimum stock levels of critical dies
- Track lead times for sharpening services
- Prevent production delays by monitoring die availability

#### 4. **Documentation & Training**
- Record reason for every die change
- Track which technician performed the change
- Maintain notes on die performance issues

#### 5. **Continuous Improvement**
- Analyze die failure patterns
- Track cost per die lifecycle
- Identify opportunities to extend die life

---

## System Requirements

### Functional Requirements

#### Die Management
- Create/edit/delete die records
- Assign unique identifiers to each die
- Track die specifications (type, size, manufacturer, etc.)
- Support barcode/QR code generation

#### Status Tracking
- Track current die status (active, available, sharpening, retired, etc.)
- Track die location (specific machine or storage location)
- Record sharpening history with dates and vendors
- Track total cycles/uses per die

#### Machine Assignment
- Track which die is currently installed in each card punch machine
- Record installation date and technician
- Document reason for die change
- Track expected die change schedule

#### Sharpening Management
- Schedule dies for sharpening
- Track vendor/service provider
- Record ship date and expected return date
- Track sharpening costs
- Maintain sharpening count per die

#### Change History
- Complete audit trail of all die movements
- Capture reason codes for every die change
- Track who performed each action
- Time-stamped event log

### Non-Functional Requirements
- Integration with existing parts/machines database
- Role-based access control
- Mobile-responsive interface for shop floor use
- Export reports to Excel/PDF
- Dashboard with key metrics

---

## Die Lifecycle States & Workflows

### Die Status States

```
┌─────────────────────────────────────────────────────────────┐
│                    DIE LIFECYCLE STATES                      │
└─────────────────────────────────────────────────────────────┘

1. NEW - Die just received, not yet used
   ↓
2. AVAILABLE - Die sharpened and ready for use in storage
   ↓
3. INSTALLED - Die currently in a machine
   ↓
4. NEEDS_SHARPENING - Die removed from machine, needs service
   ↓
5. SCHEDULED_FOR_SHARPENING - Scheduled to be sent out
   ↓
6. SHIPPED_FOR_SHARPENING - Sent to external vendor
   ↓
7. AT_SHARPENING_VENDOR - Currently being sharpened
   ↓
8. RETURNING_FROM_SHARPENING - Shipped back from vendor
   ↓
9. AVAILABLE - Back in inventory, ready for reuse
   ↓
10. RETIRED - End of life, no longer usable
```

### Change Reason Codes

Standard reason codes for why a die is being changed:

| Code | Reason | Description |
|------|--------|-------------|
| SCH_MAINT | Scheduled Maintenance | Regular scheduled die replacement |
| DULL | Dull/Worn | Die has become dull and needs sharpening |
| DAMAGED | Damaged | Die is damaged and needs repair or retirement |
| QUALITY | Quality Issues | Die producing poor quality output |
| PROD_CHANGE | Production Change | Different die needed for new product |
| PREVENTIVE | Preventive | Replacing before issues occur |
| EMERGENCY | Emergency Breakdown | Machine stopped due to die failure |
| TESTING | Testing | Installing different die for testing |
| UPGRADE | Upgrade | Replacing with better/newer die |

### Workflow Diagrams

#### Workflow 1: Normal Die Change Cycle
```
[Die in Machine (INSTALLED)]
         ↓
    [Performance Issue Detected]
         ↓
    [Remove Die] → Record: Technician, Date, Reason
         ↓
    [Inspect Die]
         ↓
    ┌─────────────┐
    │ Still Sharp? │
    └─────────────┘
      ↙         ↘
    YES          NO
     ↓            ↓
[AVAILABLE]   [NEEDS_SHARPENING]
     ↓            ↓
[Storage]    [Schedule Sharpening]
                 ↓
         [SCHEDULED_FOR_SHARPENING]
                 ↓
         [Ship to Vendor]
                 ↓
         [SHIPPED_FOR_SHARPENING]
                 ↓
         [Vendor Completes Work]
                 ↓
         [RETURNING_FROM_SHARPENING]
                 ↓
         [Receive & Inspect]
                 ↓
         [AVAILABLE in Storage]
```

#### Workflow 2: Install Die in Machine
```
[Select Machine]
         ↓
[Choose Die from Available Dies]
         ↓
[Record Installation Details]
    - Technician Name
    - Date/Time
    - Previous Die Removed
    - Reason for Change
    - Expected Runtime
         ↓
[Update Die Status to INSTALLED]
         ↓
[Update Machine Record with Current Die]
         ↓
[Create Change History Record]
```

---

## Database Schema Design

### New Tables

#### Table: `die_documents`
Store documents attached to dies (PO PDFs, invoices, inspection reports, etc.)

```sql
CREATE TABLE die_documents (
    document_id SERIAL PRIMARY KEY,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    sharpening_id INTEGER REFERENCES die_sharpening_records(sharpening_id) ON DELETE SET NULL,
    
    -- File Information
    file_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    document_type VARCHAR(50) NOT NULL,         -- file extension (pdf, jpg, png, etc.)
    
    -- Document Classification
    document_category VARCHAR(50) NOT NULL,     -- 'purchase_order', 'invoice', 'inspection_report', 
                                                -- 'sharpening_receipt', 'specification', 'other'
    title VARCHAR(255),                         -- User-friendly title
    description TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    uploaded_by_name VARCHAR(255),
    
    -- PDF Text Extraction (for search)
    text_content TEXT,                          -- Extracted text from PDF for searching
    
    -- Tracking
    related_po_number VARCHAR(100),             -- Link to PO number if applicable
    document_date DATE,                         -- Date on the document itself
    
    notes TEXT
);

-- Indexes
CREATE INDEX idx_die_documents_die_id ON die_documents(die_id);
CREATE INDEX idx_die_documents_sharpening_id ON die_documents(sharpening_id);
CREATE INDEX idx_die_documents_category ON die_documents(document_category);
CREATE INDEX idx_die_documents_created_at ON die_documents(created_at);
CREATE INDEX idx_die_documents_po_number ON die_documents(related_po_number);

-- Full-text search index for PDF content
CREATE INDEX idx_die_documents_text_content ON die_documents 
    USING gin(to_tsvector('english', text_content)) 
    WHERE text_content IS NOT NULL;

-- Comments
COMMENT ON TABLE die_documents IS 'Stores documents related to dies including sharpening POs, invoices, and inspection reports';
COMMENT ON COLUMN die_documents.text_content IS 'Extracted text from PDF files for full-text search';
```

#### Table: `dies`
Primary table for die inventory

```sql
CREATE TABLE dies (
    die_id SERIAL PRIMARY KEY,
    die_number VARCHAR(50) UNIQUE NOT NULL,  -- e.g., "DIE-2024-001"
    die_name VARCHAR(255) NOT NULL,
    die_type VARCHAR(100) NOT NULL,          -- e.g., "Round Punch", "Square Die"
    die_size VARCHAR(50),                     -- e.g., "0.125 inch", "3mm"
    manufacturer VARCHAR(255),
    manufacturer_part_number VARCHAR(100),
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    
    -- Current Status
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    current_location VARCHAR(255),            -- e.g., "Storage-A3", "Machine-5"
    machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
    
    -- Usage Tracking
    total_cycles INTEGER DEFAULT 0,           -- Total uses
    max_cycles_before_sharpening INTEGER,     -- When to sharpen
    sharpenings_count INTEGER DEFAULT 0,      -- How many times sharpened
    max_sharpenings INTEGER,                  -- Max before retirement
    
    -- Quality Metrics
    last_inspection_date DATE,
    last_inspection_notes TEXT,
    expected_life_cycles INTEGER,
    
    -- Barcode/QR
    barcode VARCHAR(255) UNIQUE,
    qr_code_path VARCHAR(500),
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    
    -- Constraints
    CHECK (status IN ('NEW', 'AVAILABLE', 'INSTALLED', 'NEEDS_SHARPENING', 
                      'SCHEDULED_FOR_SHARPENING', 'SHIPPED_FOR_SHARPENING',
                      'AT_SHARPENING_VENDOR', 'RETURNING_FROM_SHARPENING', 'RETIRED'))
);

-- Indexes
CREATE INDEX idx_dies_status ON dies(status);
CREATE INDEX idx_dies_machine_id ON dies(machine_id);
CREATE INDEX idx_dies_die_number ON dies(die_number);
CREATE INDEX idx_dies_barcode ON dies(barcode);
```

#### Table: `die_change_history`
Tracks every time a die is installed or removed from a machine

```sql
CREATE TABLE die_change_history (
    change_id SERIAL PRIMARY KEY,
    machine_id INTEGER NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(20) NOT NULL,              -- 'INSTALL' or 'REMOVE'
    change_reason_code VARCHAR(50) NOT NULL,  -- From reason codes list
    change_reason_notes TEXT,
    
    -- Who & When
    technician_id INTEGER REFERENCES technicians(technician_id),
    technician_name VARCHAR(255),
    change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Installation Specifics (for INSTALL actions)
    expected_runtime_hours INTEGER,
    expected_cycles INTEGER,
    
    -- Removal Specifics (for REMOVE actions)
    actual_runtime_hours INTEGER,
    actual_cycles INTEGER,
    cycles_at_removal INTEGER,
    die_condition VARCHAR(50),                -- 'GOOD', 'FAIR', 'POOR'
    
    -- Previous Die (when installing new die)
    previous_die_id INTEGER REFERENCES dies(die_id) ON DELETE SET NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (action IN ('INSTALL', 'REMOVE')),
    CHECK (die_condition IN ('GOOD', 'FAIR', 'POOR', NULL))
);

-- Indexes
CREATE INDEX idx_die_change_history_machine_id ON die_change_history(machine_id);
CREATE INDEX idx_die_change_history_die_id ON die_change_history(die_id);
CREATE INDEX idx_die_change_history_date ON die_change_history(change_date);
CREATE INDEX idx_die_change_history_technician ON die_change_history(technician_id);
```

#### Table: `die_sharpening_records`
Tracks sharpening service history

```sql
CREATE TABLE die_sharpening_records (
    sharpening_id SERIAL PRIMARY KEY,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    
    -- Sharpening Details
    sharpening_vendor VARCHAR(255),
    vendor_contact VARCHAR(255),
    vendor_phone VARCHAR(50),
    po_number VARCHAR(100),                   -- Purchase order reference
    
    -- Dates & Timeline
    scheduled_date DATE,
    shipped_date DATE,
    received_by_vendor_date DATE,
    expected_return_date DATE,
    actual_return_date DATE,
    
    -- Tracking
    tracking_number_outbound VARCHAR(100),
    tracking_number_inbound VARCHAR(100),
    
    -- Cost
    quoted_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    
    -- Quality
    condition_before VARCHAR(50),             -- Before sharpening
    condition_after VARCHAR(50),              -- After sharpening
    inspection_passed BOOLEAN,
    inspection_notes TEXT,
    
    -- Service Details
    service_type VARCHAR(100),                -- e.g., "Standard Sharpen", "Re-grind"
    turnaround_days INTEGER,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    
    CHECK (status IN ('SCHEDULED', 'SHIPPED', 'AT_VENDOR', 'COMPLETED', 'RETURNED', 'CANCELLED'))
);

-- Indexes
CREATE INDEX idx_die_sharpening_die_id ON die_sharpening_records(die_id);
CREATE INDEX idx_die_sharpening_status ON die_sharpening_records(status);
CREATE INDEX idx_die_sharpening_dates ON die_sharpening_records(scheduled_date, expected_return_date);
```

#### Table: `die_maintenance_schedule`
Preventive maintenance scheduling

```sql
CREATE TABLE die_maintenance_schedule (
    schedule_id SERIAL PRIMARY KEY,
    die_id INTEGER NOT NULL REFERENCES dies(die_id) ON DELETE CASCADE,
    machine_id INTEGER REFERENCES machines(machine_id) ON DELETE SET NULL,
    
    -- Schedule Details
    maintenance_type VARCHAR(100) NOT NULL,   -- 'SHARPENING', 'INSPECTION', 'REPLACEMENT'
    scheduled_date DATE NOT NULL,
    frequency_days INTEGER,                    -- How often to repeat
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    completed_date DATE,
    completed_by INTEGER REFERENCES technicians(technician_id),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'OVERDUE')),
    CHECK (maintenance_type IN ('SHARPENING', 'INSPECTION', 'REPLACEMENT'))
);

-- Indexes
CREATE INDEX idx_die_maintenance_die_id ON die_maintenance_schedule(die_id);
CREATE INDEX idx_die_maintenance_scheduled_date ON die_maintenance_schedule(scheduled_date);
CREATE INDEX idx_die_maintenance_status ON die_maintenance_schedule(status);
```

### Modified Tables

#### Update `machines` table
Add die-specific fields to track current die

```sql
ALTER TABLE machines ADD COLUMN IF NOT EXISTS current_die_id INTEGER REFERENCES dies(die_id) ON DELETE SET NULL;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS die_installed_date TIMESTAMP;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS die_installed_by INTEGER REFERENCES technicians(technician_id);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_type VARCHAR(100);

-- Add index
CREATE INDEX IF NOT EXISTS idx_machines_current_die ON machines(current_die_id);

-- Add comment
COMMENT ON COLUMN machines.current_die_id IS 'Currently installed die in this machine';
```

---

## API Endpoints Specification

### Die Management Endpoints

#### 1. Create Die
```
POST /api/v1/dies
Authentication: Required
Role: Admin, Manager

Request Body:
{
  "die_number": "DIE-2024-001",
  "die_name": "Round Punch 1/8 inch",
  "die_type": "Round Punch",
  "die_size": "0.125 inch",
  "manufacturer": "Acme Die Co",
  "manufacturer_part_number": "RP-125",
  "purchase_date": "2024-01-15",
  "purchase_cost": 350.00,
  "max_cycles_before_sharpening": 10000,
  "max_sharpenings": 15,
  "expected_life_cycles": 150000,
  "current_location": "Storage-A3",
  "notes": "Primary die for standard cards"
}

Response: 201 Created
{
  "die_id": 1,
  "die_number": "DIE-2024-001",
  "status": "NEW",
  ...
}
```

#### 2. Get All Dies
```
GET /api/v1/dies?status=AVAILABLE&machine_id=5
Authentication: Required

Query Parameters:
- status: Filter by status
- machine_id: Filter by machine
- die_type: Filter by type
- location: Filter by location
- needs_sharpening: Boolean, shows dies approaching sharpening limit

Response: 200 OK
{
  "dies": [...],
  "total": 50,
  "page": 1,
  "per_page": 20
}
```

#### 3. Get Die Details
```
GET /api/v1/dies/:die_id
Authentication: Required

Response: 200 OK
{
  "die_id": 1,
  "die_number": "DIE-2024-001",
  "status": "INSTALLED",
  "current_location": "Machine-5",
  "machine_id": 5,
  "machine_name": "Card Punch Alpha",
  "total_cycles": 8500,
  "sharpenings_count": 3,
  "last_sharpening_date": "2024-10-01",
  "next_sharpening_due": "2024-12-30",
  ...
}
```

#### 4. Update Die
```
PUT /api/v1/dies/:die_id
Authentication: Required
Role: Admin, Manager

Request Body: (any fields to update)
```

#### 5. Delete Die
```
DELETE /api/v1/dies/:die_id
Authentication: Required
Role: Admin
```

### Die Change Operations

#### 6. Install Die in Machine
```
POST /api/v1/dies/:die_id/install
Authentication: Required

Request Body:
{
  "machine_id": 5,
  "technician_id": 3,
  "technician_name": "John Smith",
  "change_reason_code": "SCH_MAINT",
  "change_reason_notes": "Regular scheduled replacement",
  "expected_runtime_hours": 480,
  "expected_cycles": 10000,
  "previous_die_id": 2
}

Response: 200 OK
{
  "message": "Die installed successfully",
  "change_history_id": 101,
  "die_status": "INSTALLED",
  "machine_current_die": "DIE-2024-001"
}
```

#### 7. Remove Die from Machine
```
POST /api/v1/dies/:die_id/remove
Authentication: Required

Request Body:
{
  "machine_id": 5,
  "technician_id": 3,
  "technician_name": "John Smith",
  "change_reason_code": "DULL",
  "change_reason_notes": "Die needs sharpening - producing rough edges",
  "actual_runtime_hours": 450,
  "actual_cycles": 9800,
  "die_condition": "FAIR",
  "needs_sharpening": true
}

Response: 200 OK
{
  "message": "Die removed successfully",
  "change_history_id": 102,
  "die_status": "NEEDS_SHARPENING",
  "machine_current_die": null
}
```

#### 8. Get Die Change History
```
GET /api/v1/dies/:die_id/history
Authentication: Required

Response: 200 OK
{
  "history": [
    {
      "change_id": 102,
      "action": "REMOVE",
      "machine_name": "Card Punch Alpha",
      "technician_name": "John Smith",
      "change_reason_code": "DULL",
      "change_date": "2024-12-22T10:30:00Z",
      ...
    },
    ...
  ]
}
```

### Sharpening Management

#### 9. Schedule Die for Sharpening
```
POST /api/v1/dies/:die_id/schedule-sharpening
Authentication: Required

Request Body:
{
  "sharpening_vendor": "Precision Sharpening Services",
  "vendor_contact": "Mike Johnson",
  "vendor_phone": "555-0123",
  "scheduled_date": "2024-12-23",
  "expected_return_date": "2024-12-27",
  "service_type": "Standard Sharpen",
  "quoted_cost": 75.00,
  "notes": "Urgent - needed for weekend production"
}

Response: 201 Created
{
  "sharpening_id": 15,
  "die_status": "SCHEDULED_FOR_SHARPENING",
  ...
}
```

#### 10. Ship Die for Sharpening
```
POST /api/v1/sharpening/:sharpening_id/ship
Authentication: Required

Request Body:
{
  "shipped_date": "2024-12-23",
  "tracking_number_outbound": "1Z999AA10123456784",
  "po_number": "PO-2024-456"
}

Response: 200 OK
```

#### 11. Receive Die from Sharpening
```
POST /api/v1/sharpening/:sharpening_id/receive
Authentication: Required

Request Body:
{
  "actual_return_date": "2024-12-27",
  "actual_cost": 75.00,
  "condition_after": "EXCELLENT",
  "inspection_passed": true,
  "inspection_notes": "Die sharp and clean, ready for use"
}

Response: 200 OK
{
  "message": "Die received and inspection complete",
  "die_status": "AVAILABLE"
}
```

#### 12. Get Sharpening Records
```
GET /api/v1/dies/:die_id/sharpening-history
Authentication: Required

Response: 200 OK
{
  "sharpenings": [...],
  "total_sharpenings": 3,
  "average_cost": 72.50,
  "average_turnaround_days": 4
}
```

### Dashboard & Reports

#### 13. Get Dies Dashboard
```
GET /api/v1/dies/dashboard
Authentication: Required

Response: 200 OK
{
  "summary": {
    "total_dies": 50,
    "available_dies": 25,
    "installed_dies": 15,
    "dies_at_sharpening": 5,
    "dies_need_sharpening": 3,
    "retired_dies": 2
  },
  "alerts": [
    {
      "type": "NEEDS_SHARPENING",
      "die_number": "DIE-2024-003",
      "message": "Die approaching sharpening limit (9500/10000 cycles)"
    },
    {
      "type": "OVERDUE_RETURN",
      "die_number": "DIE-2024-007",
      "message": "Die overdue from sharpening (expected 2024-12-20)"
    }
  ],
  "upcoming_maintenance": [...]
}
```

#### 14. Get Machine Die Status
```
GET /api/v1/machines/:machine_id/die-status
Authentication: Required

Response: 200 OK
{
  "machine_id": 5,
  "machine_name": "Card Punch Alpha",
  "current_die": {
    "die_id": 1,
    "die_number": "DIE-2024-001",
    "installed_date": "2024-12-01T08:00:00Z",
    "installed_by": "John Smith",
    "cycles_since_install": 8500,
    "cycles_remaining": 1500,
    "status": "GOOD",
    "needs_sharpening_soon": true
  },
  "change_history": [...]
}
```

#### 15. Get Reports
```
GET /api/v1/reports/dies
Authentication: Required

Query Parameters:
- report_type: 'usage', 'sharpening', 'costs', 'downtime'
- start_date: Date
- end_date: Date
- format: 'json', 'csv', 'pdf'

Response varies by report type
```

### Document Management Endpoints

#### 16. Upload Document to Die
```
POST /api/v1/dies/:die_id/documents
Authentication: Required
Content-Type: multipart/form-data

Form Data:
- file: File (PDF, JPG, PNG, etc.)
- document_category: String ('purchase_order', 'invoice', 'inspection_report', 
                            'sharpening_receipt', 'specification', 'other')
- title: String (optional)
- description: String (optional)
- sharpening_id: Integer (optional, if related to specific sharpening)
- related_po_number: String (optional)
- document_date: Date (optional)

Response: 201 Created
{
  "document_id": 1,
  "die_id": 5,
  "file_name": "sharpening-po-1234.pdf",
  "document_category": "purchase_order",
  "file_size": 245678,
  "created_at": "2024-12-22T15:30:00Z",
  "text_content_extracted": true
}
```

#### 17. Get Die Documents
```
GET /api/v1/dies/:die_id/documents
Authentication: Required

Query Parameters:
- category: Filter by document category
- sharpening_id: Filter by sharpening record

Response: 200 OK
{
  "documents": [
    {
      "document_id": 1,
      "file_name": "sharpening-po-1234.pdf",
      "document_category": "purchase_order",
      "title": "Sharpening PO from Precision Services",
      "file_size": 245678,
      "related_po_number": "PO-2024-1234",
      "document_date": "2024-12-15",
      "created_at": "2024-12-22T15:30:00Z",
      "created_by_name": "John Smith",
      "download_url": "/api/v1/documents/1/download"
    }
  ],
  "total": 5
}
```

#### 18. Download Document
```
GET /api/v1/documents/:document_id/download
Authentication: Required

Response: File download
Content-Type: application/pdf (or appropriate type)
Content-Disposition: attachment; filename="sharpening-po-1234.pdf"
```

#### 19. Delete Document
```
DELETE /api/v1/documents/:document_id
Authentication: Required
Role: Admin, Manager

Response: 200 OK
{
  "message": "Document deleted successfully"
}
```

#### 20. Upload Document to Sharpening Record
```
POST /api/v1/sharpening/:sharpening_id/documents
Authentication: Required
Content-Type: multipart/form-data

Form Data:
- file: File
- document_category: String
- title: String (optional)
- description: String (optional)

Response: 201 Created
(Automatically links to both die and sharpening record)
```

#### 21. Search Documents
```
GET /api/v1/dies/documents/search
Authentication: Required

Query Parameters:
- q: Search query (searches text_content, title, description)
- category: Filter by category
- start_date: Filter by document_date or created_at
- end_date: Filter by document_date or created_at
- die_id: Filter by specific die

Response: 200 OK
{
  "results": [...],
  "total": 15,
  "query": "purchase order"
}
```

---

## User Interface Components

### 1. Die Management Dashboard

**Location:** `/dies/dashboard`

**Features:**
- **Status Cards:** Display count of dies in each status
- **Alerts Section:** 
  - Dies needing sharpening soon
  - Dies overdue from sharpening
  - Dies approaching end of life
- **Quick Actions:**
  - Add New Die
  - Schedule Sharpening
  - View All Dies
- **Charts:**
  - Die Status Distribution (Pie Chart)
  - Sharpening Trends (Line Chart)
  - Die Utilization by Machine (Bar Chart)

**Mock Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Die Management Dashboard                    [+ Add New Die] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Available │ │Installed │ │ Sharpen  │ │  Needs   │       │
│ │    25    │ │    15    │ │     5    │ │  Sharp   │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│ ⚠ ALERTS                                                     │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ • DIE-2024-003 needs sharpening (9500/10000 cycles)  │   │
│ │ • DIE-2024-007 overdue from vendor (5 days)          │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
│ MACHINES WITH DIES                                            │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Machine         Die #         Cycles    Status        │   │
│ │ Card Punch A    DIE-2024-001  8500/10k  ⚠ Warning    │   │
│ │ Card Punch B    DIE-2024-005  3200/10k  ✓ Good       │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2. Die Inventory List

**Location:** `/dies`

**Features:**
- **Filters:**
  - Status dropdown
  - Die Type
  - Location
  - Search by die number/name
- **Table Columns:**
  - Die Number (clickable)
  - Die Name
  - Type
  - Status (badge with color)
  - Location
  - Cycles Used
  - Sharpenings Count
  - Actions (View, Edit, Change Status)
- **Bulk Actions:**
  - Export to Excel
  - Print Labels/QR Codes
- **Sort:** Any column

### 3. Die Detail View

**Location:** `/dies/:id`

**Tabs:**

**Tab 1: Overview**
- Die specifications
- Current status and location
- Usage statistics
- QR code display
- Quick actions (Install, Remove, Schedule Sharpening)

**Tab 2: Change History**
- Timeline of all installations/removals
- Who, when, why for each change
- Machine assignments history

**Tab 3: Sharpening History**
- List of all sharpening services
- Costs and turnaround times
- Vendor information
- Quality inspection results

**Tab 4: Maintenance Schedule**
- Upcoming scheduled maintenance
- Past maintenance completed

**Tab 5: Documents** *(NEW)*
- List of all attached documents
- Filter by category (PO, Invoice, Inspection, etc.)
- Upload new document button
- Preview/Download options
- Document metadata (date, uploaded by, size)

**Document List Display:**
```
┌─────────────────────────────────────────────────────────────┐
│ Documents (5)                           [+ Upload Document] │
├─────────────────────────────────────────────────────────────┤
│ 📄 Sharpening PO - Precision Services                       │
│    Category: Purchase Order | Dec 15, 2024 | 245 KB        │
│    PO#: PO-2024-1234 | Uploaded by: John Smith             │
│    [View] [Download] [Delete]                               │
│                                                               │
│ 📄 Invoice #5678                                             │
│    Category: Invoice | Dec 20, 2024 | 156 KB               │
│    Related to: Sharpening #3 | Uploaded by: Sarah Lee      │
│    [View] [Download] [Delete]                               │
│                                                               │
│ 📄 Inspection Report                                         │
│    Category: Inspection Report | Dec 21, 2024 | 89 KB      │
│    [View] [Download] [Delete]                               │
└─────────────────────────────────────────────────────────────┘
```

### 4. Die Change Dialog

**Trigger:** When installing or removing a die from a machine

**Form Fields:**

**For Installation:**
- Select Machine (dropdown)
- Select Technician (dropdown or type)
- Reason for Change (dropdown with codes)
- Additional Notes (text area)
- Expected Runtime (hours)
- Expected Cycles
- Previous Die Being Replaced (auto-populated if machine has die)

**For Removal:**
- Machine (pre-filled)
- Technician
- Reason for Removal (dropdown)
- Additional Notes
- Actual Runtime Hours
- Actual Cycles Used
- Die Condition (Good/Fair/Poor)
- Needs Sharpening? (checkbox)

**Validation:**
- All required fields must be filled
- Confirm before changing installed die
- Alert if removing die before expected runtime

### 5. Machine View - Die Status

**Location:** `/machines/:id` (enhanced existing view)

**Add New Section:**
```
┌─────────────────────────────────────────────┐
│ CURRENT DIE STATUS                          │
├─────────────────────────────────────────────┤
│ Die Number: DIE-2024-001                    │
│ Die Type: Round Punch 1/8"                  │
│ Installed: Dec 1, 2024 by John Smith       │
│ Installed For: 21 days                      │
│ Cycles Used: 8500 / 10000                  │
│ Status: ⚠ Warning - Approaching Limit       │
│                                              │
│ [Change Die] [View Die Details]             │
└─────────────────────────────────────────────┘
```

### 6. Sharpening Management View

**Location:** `/dies/sharpening`

**Features:**

**Status Tabs:**
- Scheduled (need to ship)
- Shipped (in transit to vendor)
- At Vendor (being serviced)
- Returning (in transit back)
- Completed (archived)

**Table for Each Tab:**
- Die Number
- Vendor
- Scheduled/Ship Date
- Expected Return
- Days Elapsed
- Status
- Actions (Ship, Mark Received, View Details)

**Quick Actions:**
- Schedule New Sharpening
- Bulk Ship Dies
- Contact Vendor

**Enhanced with Documents:** *(NEW)*
- Each sharpening record shows document count badge
- Quick upload button in actions column
- View attached documents inline

**Sharpening Detail with Documents:**
```
┌─────────────────────────────────────────────────────────────┐
│ Sharpening Record #15 - DIE-2024-001                        │
├─────────────────────────────────────────────────────────────┤
│ Vendor: Precision Sharpening Services                       │
│ Status: At Vendor                                            │
│ Expected Return: Dec 27, 2024                               │
│                                                               │
│ 📎 DOCUMENTS (3)                        [+ Upload Document] │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ 📄 Purchase Order PO-2024-1234                        │   │
│ │    245 KB | Uploaded Dec 15, 2024                     │   │
│ │    [View] [Download]                                  │   │
│ │                                                        │   │
│ │ 📄 Shipping Receipt                                   │   │
│ │    156 KB | Uploaded Dec 16, 2024                     │   │
│ │    Tracking: 1Z999AA10123456784                       │   │
│ │    [View] [Download]                                  │   │
│ └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7. Document Upload Dialog *(NEW)*

**Location:** Modal dialog triggered from die detail or sharpening record

**Features:**

**Upload Form:**
```
┌─────────────────────────────────────────────────────────────┐
│ Upload Document                                        [X]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 📁 Drag & Drop File Here or Click to Browse                 │
│    (PDF, JPG, PNG, DOCX - Max 10MB)                         │
│                                                               │
│ Category: [Purchase Order ▼]                                │
│           - Purchase Order                                   │
│           - Invoice                                          │
│           - Inspection Report                                │
│           - Sharpening Receipt                               │
│           - Specification Sheet                              │
│           - Other                                            │
│                                                               │
│ Title: [Optional - e.g., "PO from Precision Services"]      │
│                                                               │
│ Description: [Optional notes about this document]            │
│                                                               │
│ Document Date: [Dec 15, 2024]                               │
│                                                               │
│ Related PO Number: [PO-2024-1234] (if applicable)           │
│                                                               │
│ Link to Sharpening: [Sharpening #15 ▼] (if applicable)     │
│                                                               │
│                                  [Cancel] [Upload Document]  │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Drag and drop file upload
- File type validation
- File size validation (max 10MB)
- Auto-extract text from PDFs for searching
- Preview uploaded file before saving
- Progress bar during upload
- Success/error notifications

**Supported File Types:**
- PDF (with text extraction)
- Images (JPG, PNG, GIF)
- Documents (DOCX, XLSX - optional)

### 8. Reports & Analytics

**Location:** `/dies/reports`

**Report Types:**

**A. Die Usage Report**
- Dies by machine
- Total cycles per die
- Average runtime per installation
- Most/least used dies

**B. Sharpening Report**
- Sharpening frequency per die
- Average costs
- Turnaround times by vendor
- Total sharpening costs (monthly/yearly)

**C. Downtime Report**
- Die-related downtime incidents
- Time to replace dies
- Impact on production

**D. Cost Analysis**
- Total cost per die (purchase + sharpening)
- Cost per cycle
- ROI by die type

**E. Predictive Analysis**
- Dies approaching sharpening limit
- Estimated dates for next sharpening
- Dies nearing retirement

### 8. Mobile/Tablet Interface

**Simplified views for shop floor use:**

**Quick Die Change Screen:**
- Large buttons
- Barcode scanner integration
- Quick reason code selection
- Signature capture for technician
- Photo capture for die condition

---

## Integration Points

### 1. Existing Parts System
- Dies can be tracked as specialized parts if desired
- Link die records to parts inventory
- Share barcode scanning infrastructure

### 2. Machines System
- Extend machine records to track current die
- Show die status on machine dashboard
- Include die changes in machine maintenance logs

### 3. Work Orders System
- Create work orders for die changes
- Link die sharpening to work order system
- Track labor costs for die installations

### 4. Technician Management
- Use existing technicians table
- Track die-related work per technician
- Performance metrics for die installations

### 5. Purchase Orders
- Generate POs for sharpening services
- Track sharpening costs in financial system
- Vendor management for sharpening services
- **Attach PO documents to die records** *(NEW)*

### 6. Document Management System *(NEW)*
- Leverage existing document infrastructure (similar to machine documents and PO documents)
- Store documents in `/uploads/die_documents/` directory
- Automatic PDF text extraction for searchability
- Support for multiple document categories
- Link documents to both dies and specific sharpening records

### 7. Notifications System
- Email alerts for dies needing sharpening
- Notifications when dies return from vendor
- Alerts for overdue returns
- Daily/weekly status reports

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Database setup and basic CRUD operations

**Tasks:**
1. Create database migration scripts for all tables (dies, die_documents, die_change_history, die_sharpening_records, die_maintenance_schedule)
2. Run migrations in development environment
3. Create API endpoints for die CRUD operations
4. Set up file upload infrastructure for documents
5. Write unit tests for API endpoints
6. Set up basic authentication/authorization

**Deliverables:**
- ✅ Database schema created (including die_documents table)
- ✅ API endpoints functional
- ✅ Document upload/download working
- ✅ Tests passing

### Phase 2: Die Change Tracking (Week 3-4)
**Goal:** Track die installations and removals

**Tasks:**
1. Implement die change history endpoints
2. Create machine-die relationship tracking
3. Build die change dialog UI component
4. Integrate with machine view
5. Add validation and business logic
6. Create change history timeline UI

**Deliverables:**
- ✅ Can install/remove dies from machines
- ✅ Complete audit trail of changes
- ✅ Reason codes tracking

### Phase 3: Sharpening Management (Week 5-6)
**Goal:** Manage die sharpening lifecycle

**Tasks:**
1. Implement sharpening record endpoints
2. Create sharpening workflow states
3. Build sharpening management UI
4. Add vendor management
5. Implement date tracking and alerts
6. Create sharpening cost tracking
7. **Implement document attachment to sharpening records** *(NEW)*
8. **Build document upload dialog component** *(NEW)*
9. **Add PDF text extraction service** *(NEW)*

**Deliverables:**
- ✅ Can schedule and track sharpening
- ✅ Vendor communication tracking
- ✅ Cost tracking functional
- ✅ Can attach PO PDFs and invoices to sharpening records
- ✅ Documents searchable by content

### Phase 4: Dashboard & Reporting (Week 7-8)
**Goal:** Visibility and analytics

**Tasks:**
1. Create die dashboard with metrics
2. Build status visualization components
3. Implement alert system
4. Create report generation
5. Add export functionality (Excel/PDF)
6. Build charts and graphs

**Deliverables:**
- ✅ Dashboard showing all key metrics
- ✅ Alert system functional
- ✅ Reports can be generated and exported

### Phase 5: Advanced Features (Week 9-10)
**Goal:** Predictive maintenance and optimization

**Tasks:**
1. Implement predictive sharpening alerts
2. Add QR code generation and scanning
3. Create mobile-friendly views
4. Build maintenance scheduling
5. Add lifecycle cost calculations
6. Implement notification system

**Deliverables:**
- ✅ Predictive alerts working
- ✅ QR codes functional
- ✅ Mobile interface complete

### Phase 6: Testing & Training (Week 11-12)
**Goal:** Ensure quality and user adoption

**Tasks:**
1. Comprehensive testing (unit, integration, E2E)
2. User acceptance testing
3. Create user documentation
4. Conduct training sessions
5. Gather feedback and iterate
6. Performance optimization

**Deliverables:**
- ✅ All tests passing
- ✅ Users trained
- ✅ Documentation complete
- ✅ System ready for production

### Phase 7: Deployment (Week 13)
**Goal:** Production rollout

**Tasks:**
1. Database backup and migration plan
2. Deploy to production
3. Monitor for issues
4. Provide support during transition
5. Collect initial feedback

**Deliverables:**
- ✅ System live in production
- ✅ Support plan in place

---

## Testing & Validation

### Test Scenarios

#### Scenario 1: New Die Entry
1. Add new die to inventory
2. Verify die number is unique
3. Check default status is "NEW"
4. Verify die appears in available dies list

#### Scenario 2: Install Die in Machine
1. Select available die
2. Select machine without current die
3. Fill out installation form with required fields
4. Submit installation
5. Verify:
   - Die status changes to "INSTALLED"
   - Machine record updated with die
   - Change history record created
   - Die location updated to machine

#### Scenario 3: Remove Die and Schedule Sharpening
1. Remove die from machine with reason "DULL"
2. Mark die as needs sharpening
3. Verify die status changes to "NEEDS_SHARPENING"
4. Schedule die for sharpening
5. Verify sharpening record created
6. Update status when shipped
7. Update when received
8. Verify die returns to "AVAILABLE"

#### Scenario 4: Die Reaches Cycle Limit
1. Die approaches max cycles (e.g., 9500/10000)
2. Verify alert appears on dashboard
3. Verify notification sent to manager
4. Remove die and schedule sharpening
5. After sharpening, verify cycles reset or tracked

#### Scenario 5: Die Retirement
1. Die reaches maximum sharpenings
2. Mark die as "RETIRED"
3. Verify die no longer appears in available list
4. Verify die cannot be installed
5. Verify historical data preserved

#### Scenario 6: Machine Die Status
1. View machine details
2. Verify current die displayed
3. Check die statistics accurate
4. Verify change die button available
5. View die change history for machine

### Validation Checklist

- [ ] All die status transitions follow defined workflow
- [ ] Cannot install die that is not available
- [ ] Cannot have two dies installed in same machine simultaneously
- [ ] Change reason is required for every die change
- [ ] Technician is recorded for every change
- [ ] Cycle counts are accurate
- [ ] Sharpening costs are tracked correctly
- [ ] Date calculations are accurate
- [ ] Alerts trigger at correct thresholds
- [ ] Reports show accurate data
- [ ] Export functions work correctly
- [ ] Mobile interface is responsive
- [ ] Barcode scanning works (if implemented)
- [ ] Permissions enforced correctly
- [ ] Audit trail is complete and accurate
- [ ] **Document upload works for all supported file types** *(NEW)*
- [ ] **PDF text extraction works correctly** *(NEW)*
- [ ] **Documents can be attached to dies and sharpening records** *(NEW)*
- [ ] **Document search returns relevant results** *(NEW)*
- [ ] **Document download works with correct MIME types** *(NEW)*
- [ ] **Document deletion removes files and database records** *(NEW)*
- [ ] **File size limits are enforced** *(NEW)*
- [ ] **Document categories are tracked correctly** *(NEW)*

---

## Success Metrics

### Operational Metrics
- **Die Availability:** % of time required dies are available
- **Average Downtime:** Time to change dies
- **Sharpening Turnaround:** Average days from ship to return
- **Die Utilization:** % of dies actively in use
- **Cycle Tracking Accuracy:** % of die changes with cycle counts recorded

### Financial Metrics
- **Cost per Die Cycle:** Total die costs / total cycles
- **Sharpening Cost Trends:** Month-over-month tracking
- **Die ROI:** Total cycles vs. total costs

### Quality Metrics
- **Die Life Extension:** Average cycles between sharpenings
- **Premature Failures:** Dies retired before expected life
- **Documentation Completeness:** % of changes with complete records

---

## Appendices

### A. Reason Code Reference

| Code | Use Case | Example |
|------|----------|---------|
| SCH_MAINT | Regular scheduled replacement | Monthly die rotation |
| DULL | Die lost sharpness | Poor edge quality on cards |
| DAMAGED | Physical damage to die | Die cracked or chipped |
| QUALITY | Output quality issues | Cards have burrs or rough edges |
| PROD_CHANGE | Different product needs different die | Switching card thickness |
| PREVENTIVE | Replacing before failure | Approaching cycle limit |
| EMERGENCY | Unexpected die failure | Die broke during operation |
| TESTING | Installing test/trial die | Evaluating new die type |
| UPGRADE | Replacing with improved die | Newer technology available |

### B. Status Color Coding

- 🟢 **GREEN:** NEW, AVAILABLE (ready to use)
- 🔵 **BLUE:** INSTALLED (currently in use)
- 🟡 **YELLOW:** NEEDS_SHARPENING, SCHEDULED_FOR_SHARPENING (action needed)
- 🟠 **ORANGE:** SHIPPED_FOR_SHARPENING, AT_SHARPENING_VENDOR (in process)
- 🟣 **PURPLE:** RETURNING_FROM_SHARPENING (arriving soon)
- 🔴 **RED:** RETIRED (end of life)

### C. Sample Notification Templates

**Alert: Die Needs Sharpening Soon**
```
Subject: Die DIE-2024-001 Approaching Sharpening Limit

Die DIE-2024-001 (Round Punch 1/8") currently installed in Machine "Card Punch Alpha" 
has 9,500 of 10,000 cycles used.

Please schedule sharpening soon to avoid production delays.

[Schedule Sharpening] [View Die Details]
```

**Alert: Die Overdue from Vendor**
```
Subject: Die DIE-2024-007 Overdue from Sharpening

Die DIE-2024-007 was expected to return from Precision Sharpening on Dec 20, 2024.
It is now 5 days overdue.

Please contact vendor to check status.

Vendor: Precision Sharpening Services
Contact: Mike Johnson (555-0123)

[View Sharpening Record] [Contact Vendor]
```

### D. Database Migration Order

1. `001_create_dies_table.sql`
2. `002_create_die_change_history_table.sql`
3. `003_create_die_sharpening_records_table.sql`
4. `004_create_die_documents_table.sql` *(NEW)*
5. `005_create_die_maintenance_schedule_table.sql`
6. `006_alter_machines_add_die_fields.sql`
7. `007_add_indexes.sql`
8. `008_add_triggers.sql`
9. `009_seed_reason_codes.sql` (optional reference data)

### E. Document Storage Structure

```
/uploads/
  /die_documents/
    /die-1/
      purchase_order-1703260800-PO-2024-1234.pdf
      invoice-1703347200-INV-5678.pdf
    /die-2/
      inspection_report-1703433600-report.pdf
    /die-3/
      ...
```

**File Naming Convention:**
- `{category}-{timestamp}-{sanitized_original_name}.{extension}`
- Example: `purchase_order-1703260800-PO-2024-1234.pdf`

**Storage Best Practices:**
- Organize by die ID in subdirectories
- Keep original filename in database for user reference
- Store absolute path in database
- Validate file types before upload
- Enforce file size limits (default 10MB)
- Extract PDF text asynchronously after upload

---

## Conclusion

This comprehensive die tracking system will provide complete visibility into die lifecycle, improve maintenance planning, reduce downtime, and optimize die-related costs. The phased implementation approach ensures manageable development cycles with clear deliverables at each stage.

The system is designed to integrate seamlessly with your existing Fiserv Inventory Management System while adding specialized functionality for die management specific to card punch machine operations.

**Key Enhancements - PDF/Document Management:**
- ✅ Die documents table with full-text search capability
- ✅ 6 new API endpoints for document operations
- ✅ Documents tab in die detail view
- ✅ Drag-and-drop upload dialog
- ✅ Automatic PDF text extraction for searching
- ✅ Link documents to both dies and sharpening records
- ✅ Support for POs, invoices, inspection reports, and more

**Next Steps:**
1. Review this comprehensive plan with stakeholders
2. Prioritize features if needed
3. Adjust timeline based on resource availability
4. Begin Phase 1 implementation after approval

---

**Document Version:** 2.0  
**Created:** December 22, 2024  
**Updated:** December 22, 2024 (Added PDF/Document Management)  
**Status:** Ready for Review  
**No Code Changes Made** - Awaiting approval before implementation
