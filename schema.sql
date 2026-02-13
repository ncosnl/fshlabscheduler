-- FSH Lab Scheduler Database Schema
-- This creates all the tables needed for your application

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Teacher', 'Admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lab_name TEXT NOT NULL,
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    teacher_email TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    num_students INTEGER NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_email) REFERENCES users(email)
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('request', 'approval')),
    reservation_id INTEGER,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    lab TEXT,
    date TEXT,
    time_slot TEXT,
    status TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_lab ON reservations(lab_name);
CREATE INDEX IF NOT EXISTS idx_reservations_teacher ON reservations(teacher_email);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_to ON notifications(to_email);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Insert a default admin account for testing
-- Password: admin123
INSERT OR IGNORE INTO users (email, password, role) 
VALUES ('admin@firstasia.edu.ph', 'admin123', 'Admin');
