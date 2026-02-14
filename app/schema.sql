-- Migration: Create initial schema for FSH Lab Scheduler
-- Date: 2026-02-14

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Hashed password (null for Google Sign-In users)
  name TEXT,
  role TEXT NOT NULL CHECK(role IN ('Teacher', 'Admin')),
  google_id TEXT UNIQUE, -- For Google Sign-In users
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  lab_name TEXT NOT NULL,
  date TEXT NOT NULL, -- Format: YYYY-MM-DD
  time_slot TEXT NOT NULL, -- e.g., "8:00 AM - 9:00 AM"
  teacher_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade TEXT NOT NULL,
  students INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT, -- Admin email who approved/rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_email);
CREATE INDEX IF NOT EXISTS idx_reservations_lab_date ON reservations(lab_name, date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('request', 'approval')),
  reservation_id INTEGER,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  lab TEXT,
  date TEXT,
  time_slot TEXT,
  status TEXT,
  read INTEGER DEFAULT 0, -- 0 = unread, 1 = read
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (from_email) REFERENCES users(email) ON DELETE CASCADE,
  FOREIGN KEY (to_email) REFERENCES users(email) ON DELETE CASCADE
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_to_email ON notifications(to_email);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_reservation ON notifications(reservation_id);

-- Sessions table (for managing user sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_email);
