class Vendor {
  constructor(
    vendor_id,
    name,
    contact_name,
    email,
    phone,
    address,
    notes
  ) {
    this.vendor_id = vendor_id;
    this.name = name;
    this.contact_name = contact_name;
    this.email = email;
    this.phone = phone;
    this.address = address;
    this.notes = notes;
  }
}

module.exports = Vendor;
