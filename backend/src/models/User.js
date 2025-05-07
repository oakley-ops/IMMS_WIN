const bcrypt = require('bcrypt');

class User {
    constructor(user_id, username, password, role) {
      this.user_id = user_id;
      this.username = username;
      this.password = password; 
      this.role = role;
    }
  
    // Method to compare passwords (used during login)
    async comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    }
  }
  
  module.exports = User;