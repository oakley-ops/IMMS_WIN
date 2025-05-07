class PurchaseOrder {
  constructor(
    po_id,
    po_number,
    vendor_id,
    status,
    total_amount,
    notes,
    created_at,
    updated_at
  ) {
    this.po_id = po_id;
    this.po_number = po_number;
    this.vendor_id = vendor_id;
    this.status = status;
    this.total_amount = total_amount;
    this.notes = notes;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}

module.exports = PurchaseOrder;
