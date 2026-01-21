const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // Update with your MySQL username
    password: 'OPEN SQL', // Update with your MySQL password
    database: 'hostel_os'
});

db.connect(err => {
    if (err) console.log('❌ DB Connection Failed:', err);
    else console.log('✅ Connected to MySQL');
});



// Login API (Simple Check for Day 1)
app.post('/api/login', (req, res) => {
    const { roll_no, password } = req.body;
    const sql = 'SELECT * FROM users WHERE roll_no = ? AND password_hash = ?';
    db.query(sql, [roll_no, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            res.json({ success: true, user: result[0] });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    });
});
// --- NEW: Gate Pass Logic Day 2---

// 1. Get Current Status (To show Green or Orange on load)
app.get('/api/gate/status/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT is_present FROM users WHERE id = ?';
    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length === 0) return res.status(404).json({ message: 'User not found' });
        
        // Return "in" if present is true, "out" if false
        res.json({ status: result[0].is_present ? 'in' : 'out' });
    });
});

// 2. Log Entry/Exit (The Check-In/Out Loop)
app.post('/api/gate/log', (req, res) => {
    const { student_id, action, reason, destination } = req.body; // action = 'out' or 'in'
    
    // Logic: If checking 'in', they are present (1). If 'out', they are absent (0).
    const isPresent = action === 'in' ? 1 : 0;

    // Transaction: Update Table A (Logs) AND Table B (Users) together
    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        // A. Insert into Logs
        // Note: We use 'exit_time' for OUT. For IN, we will update the 'actual_return' later. 
        // For simple Day 2 demo, we just log a new row for every action to keep it easy.
        const logSql = 'INSERT INTO gate_logs (student_id, status, reason, destination) VALUES (?, ?, ?, ?)';
        
        db.query(logSql, [student_id, action, reason, destination || 'Returning'], (err, result) => {
            if (err) {
                return db.rollback(() => res.status(500).json(err));
            }

            // B. Update User Status
            const userSql = 'UPDATE users SET is_present = ? WHERE id = ?';
            db.query(userSql, [isPresent, student_id], (err, result) => {
                if (err) {
                    return db.rollback(() => res.status(500).json(err));
                }
                
                // Commit the Transaction
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json(err));
                    res.json({ success: true, new_status: action });
                });
            });
        });
    });
});
app.listen(3001, () => {
    console.log('🚀 Server running on port 3001');
});