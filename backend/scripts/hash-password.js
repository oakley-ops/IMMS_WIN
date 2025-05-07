const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    console.log('Password hash for', password + ':', hash);
    return hash;
}

hashPassword('admin123'); 