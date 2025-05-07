class Part {
    constructor(
      part_id,
      name,
      description,
      quantity,
      manufacturer_part_number,
      fiserv_part_number,
      machine_id,
      supplier,
      image
    ) {
      this.part_id = part_id;
      this.name = name;
      // ... other properties
    }
  
    // Example method to update quantity
    updateQuantity(newQuantity) {
      this.quantity = newQuantity;
      // ... logic to update in the database (we'll add this later)
    }
  }
  
  module.exports = Part;