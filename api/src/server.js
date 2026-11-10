require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/database');
const { startReminderJob } = require('./services/reminderService');

const PORT = process.env.PORT || 3000;

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('Thiếu biến môi trường JWT_SECRET');
    process.exit(1);
  }
  try {
    await connectDatabase();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
  // 0.0.0.0 để emulator (10.0.2.2) và điện thoại thật cùng truy cập được
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    startReminderJob();
  });
}

start();
