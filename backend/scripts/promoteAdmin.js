require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/promoteAdmin.js user@example.com Password123');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const hashed = await bcrypt.hash(password, 10);

    let user = await User.findOne({ email });
    if (user) {
      user.role = 'admin';
      user.password = hashed;
      user.enabled = true;
      await user.save();
      console.log('Updated existing user to admin:', email);
    } else {
      user = await User.create({ name: 'Admin', email, password: hashed, role: 'admin', enabled: true });
      console.log('Created new admin user:', email);
    }
  } catch (err) {
    console.error('Error:', err.message || err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
})();
