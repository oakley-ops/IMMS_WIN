class Transaction {
    constructor(
      transaction_id,
      part_id,
      type,
      quantity,
      timestamp,
      user_id
    ) {
      this.transaction_id = transaction_id;
      this.part_id = part_id;
      this.type = type;
      this.quantity = quantity;
      this.timestamp = timestamp;
      this.user_id = user_id;
    }
  }
  
  module.exports = Transaction;