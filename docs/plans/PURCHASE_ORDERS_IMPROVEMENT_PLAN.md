# Purchase Orders — Improvement Plan & Follow-up Backlog

**Status:** Wave 1 shipped to `main` on 2026-05-30 (PRs #3, #4, #5). This document
captures what shipped (for context) and the work intentionally deferred, so it can
be picked up later with full context.

---

## Background

A deep review of the Purchase Order subsystem found that most problems were
coherence / data-model issues that surfaced as user-visible bugs. The root causes:

- **One field, three encodings** — shipping/tax/urgency/people were variously stored
  as real columns, as `[TAG]` markers in `notes`, or as a JSON blob in `notes`,
  depending on the code path that wrote them.
- **Two status systems** — an 8-value `status` column *and* a separate 3-value
  `approval_status`, read back via `COALESCE(approval_status, status)`.
- **`vendor` / `supplier` duality** — identical `Vendor` and `Supplier` types; every
  PO carries both `vendor_*` and `supplier_*` fields though the DB uses `suppliers`.
- **Multiple overlapping create paths** — generate-for-low-stock, manual form (`/blank`),
  generic `/create`, import-from-PDF, import-manual.

---

## Shipped in Wave 1 (baseline — already on `main`)

- **List pagination** — the PO list fetched with no `limit`, so the backend default
  `LIMIT 10` hid all but the 10 newest POs. Now sends an explicit limit and shows the
  real server total. (`frontend/src/services/api.ts`, `PurchaseOrderList.tsx`)
- **Totals breakdown** — the detail page shows Subtotal → Shipping → Tax → Grand Total
  instead of a single line-items-only "Total Amount". (`PurchaseOrderDetail.tsx`)
- **Canonical metadata storage** — `createBlankPurchaseOrder` and `updatePurchaseOrder`
  now write the real columns instead of JSON/`[TAG]`s in `notes`; added a
  `manual_supplier_name` column; reads coalesce the supplier name and still decode
  legacy `notes` formats for old rows. (`PurchaseOrderController.js`)
- **Manual PO PDF** — preview/email work (`returnBlob=true`), the logo path was fixed
  (`fiserv_logo_orange_rgb.png`), and the stray "Print / Save as PDF" button no longer
  bakes into exports. (`ManualPOForm.tsx`, `pdfTemplates.js`)
- **Table pagination clip** — both the PO list and Parts Usage History were wrapped in a
  fixed `height: 650` box that clipped rows and the pagination bar; removed the fixed
  height. (`PurchaseOrderList.tsx`, `pages/Transactions.tsx`)
- **Tests** — `backend/__tests__/controllers/PurchaseOrderController.metadata.test.js`
  covers the metadata read/write + legacy-notes decode.

---

## Deferred follow-ups (backlog)

### Quick wins (low effort, low risk)

1. **Remove the duplicate PO routing.**
   Routes are defined twice: nested children under `/purchase-orders` in
   `frontend/src/App.tsx` *and* an internal `<Routes>` in
   `frontend/src/pages/PurchaseOrders.tsx`. The parent element has no `<Outlet/>`, so the
   behavior is subtle — **verify at runtime before changing**, then keep one mechanism.

2. **Bulk `console.log` sweep.**
   PO frontend components (especially `PurchaseOrderDetail.tsx`) carry many debug logs that
   run in users' browsers. Some are multi-line, so strip carefully. Also trim the noisy
   server-side logs in `PurchaseOrderController.js`.

3. **Remove the dead `42703` notes fallback in `updatePurchaseOrder`.**
   It was defensive code for "columns may not exist yet." The columns exist now, so the
   fallback is unreachable and still contains old `[TAG]`-encoding logic. (`PurchaseOrderController.js`)

### Totals consistency (medium)

4. **Fold shipping + tax into the persisted `total_amount`, and into the PDF/Excel exports.**
   The stored `total_amount` is still line-items-only; the detail page computes the grand
   total on the client. Add a single `recalcTotal` helper (`subtotal + shipping + tax`) and
   call it from the three item endpoints and the shipping/tax update path so the list,
   exports, and detail all agree. Update `pdfTemplates.js` / `excelTemplates` to show the
   same breakdown. (`PurchaseOrderController.js`, `utils/pdfTemplates.js`, `utils/excelTemplates.*`)

### Larger UX / architecture (higher effort — design first)

5. **Guided status lifecycle.**
   Collapse the 8-value `status` + separate `approval_status` into a single column with a
   clear lifecycle (e.g. Draft → Submitted → Approved → Ordered → Received, with On Hold /
   Canceled as side states) and drive the detail dropdown from *allowed transitions* instead
   of free selection. Keep a generated alias during transition for compatibility.
   (`PurchaseOrderController.js` status read/write + `COALESCE`, `PurchaseOrderDetail.tsx`
   dropdown, `types/purchaseOrder.ts`) — **write a short design doc first.**

6. **Single "New PO" entry point.**
   Replace the 3+ header buttons (and 5 backend create paths) with one **New Purchase Order**
   action that opens a small chooser: *From low-stock suggestions* / *Blank / manual* /
   *Import from PDF*. Preserve every capability; just make the front door obvious.
   (`PurchaseOrderList.tsx` header, routes)

7. **Collapse the `vendor` / `supplier` duality.**
   Retire the legacy `vendor_*` fields (alias to supplier during transition), unify the
   `Vendor`/`Supplier` types, and make the two read endpoints return the same supplier field
   names so the `normalizedPO` shim in `PurchaseOrderDetail.tsx` can go away.
   (`types/purchaseOrder.ts`, `PurchaseOrderController.js`, schema)

8. **First-class custom line items.**
   Custom/miscellaneous items are still stored as JSON inside an item's `notes`, requiring
   `JSON.parse`-in-render fallback chains and "No Name" placeholders. Add real
   `custom_part_name` / `custom_part_number` columns to `purchase_order_items`.
   (`PurchaseOrderController.js` `addItemToPurchaseOrder`, `PurchaseOrderDetail.tsx` render)

---

## Operational notes & gotchas

- **Migrations are not fully automated.** `npm run migrate` runs
  `backend/migrations/run-migrations.js`, which only applies `backend/db/schema.sql`
  (machines/parts/transactions — **no `purchase_orders`**) once as `initial_schema`. The
  PO tables/columns live in `backend/migrations/*.sql` and are applied by the *other*
  runner `backend/scripts/run-migrations.js` (tracks by filename) **or manually/directly**.
- `backend/migrations/20250308_update_purchase_orders_suppliers.sql` is **non-idempotent**
  (`ADD COLUMN supplier_id` without `IF NOT EXISTS`), so blindly replaying migrations via
  `scripts/run-migrations.js` can error if `supplier_id` already exists.
- `manual_supplier_name` was applied directly to the production machine's DB on 2026-05-30
  via `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS manual_supplier_name VARCHAR(255)`.
  A fresh DB needs it (and the other PO migrations) applied the same way.
- **Verify the schema** any time with `node backend/scripts/check-po-columns.js` — it lists
  the `purchase_orders` columns and flags any the code depends on that are missing.
