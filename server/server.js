const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',     
    password: 'OPEN SQL', 
    database: 'hostel_os'
});

db.connect(err => {
    if (err) console.log('❌ DB Connection Failed:', err);
    else console.log('✅ Connected to MySQL');
});



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
    const { student_id, action, reason, destination, qr_code } = req.body; 
    console.log(qr_code);
    // --- NEW: SECURITY CHECK ---
    // Only check QR if they are trying to enter ('in')
    if (action === 'in') {
        const VALID_SECRET = "HOSTEL_SECURE"; // Must match Kiosk exactly
        
        if (qr_code !== VALID_SECRET) {
            console.log("❌ Security Alert: Invalid QR Code Scanned:", qr_code);
            return res.status(403).json({ 
                success: false, 
                message: "Security Alert: Invalid QR Code" 
            });
        }
    }
    // Logic: If checking 'in', they are present (1). If 'out', they are absent (0).
    const isPresent = action === 'in' ? 1 : 0;
    const dbStatus = action === 'in' ? 'returned' : 'out';
    // Transaction: Update Table A (Logs) AND Table B (Users) together
    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        // A. Insert into Logs
        // Note: We use 'exit_time' for OUT. For IN, we will update the 'actual_return' later. 
        // For simple Day 2 demo, we just log a new row for every action to keep it easy.
        const logSql = 'INSERT INTO gate_logs (student_id, status, reason, destination) VALUES (?, ?, ?, ?)';
        
        db.query(logSql, [student_id, dbStatus, reason, destination || 'Returning'], (err, result) => {
        if (err) {
            // --- ADD THIS LOG ---
            console.error("❌ SQL ERROR (Insert Log):", err.sqlMessage); 
            // --------------------
            return db.rollback(() => res.status(500).json({ error: err.sqlMessage }));
        }

        const userSql = 'UPDATE users SET is_present = ? WHERE id = ?';
        db.query(userSql, [isPresent, student_id], (err, result) => {
            if (err) {
                // --- ADD THIS LOG ---
                console.error("❌ SQL ERROR (Update User):", err.sqlMessage);
                // --------------------
                return db.rollback(() => res.status(500).json({ error: err.sqlMessage }));
            }
            
            db.commit(err => {
                if (err) return db.rollback(() => res.status(500).json(err));
                console.log("✅ Transaction Committed Successfully!"); // Confirm success
                res.json({ success: true, new_status: action });
            });
        });
    });
    });
});

// --- NEW: Warden Dashboard API ---

app.get('/api/warden/dashboard', (req, res) => {
    // 1. Get Count of Students currently OUT
    const countSql = 'SELECT COUNT(*) as out_count FROM users WHERE is_present = 0';
    
    // 2. Get Recent Logs (Joined with User Names)
    const logsSql = `
        SELECT gate_logs.*, users.full_name, users.roll_no 
        FROM gate_logs 
        JOIN users ON gate_logs.student_id = users.id 
        ORDER BY exit_time DESC 
        LIMIT 10
    `;

    db.query(countSql, (err, countResult) => {
        if (err) return res.status(500).json(err);
        
        db.query(logsSql, (err, logsResult) => {
            if (err) return res.status(500).json(err);
            
            res.json({
                stats: {
                    out_now: countResult[0].out_count,
                    total_students: 50 // Hardcoded for demo, or query count(*) from users
                },
                recent_logs: logsResult
            });
        });
    });
});

//Reset System 
app.post('/api/warden/reset', (req, res) => {
    const resetLogs = 'DELETE FROM gate_logs'; 
    const resetUsers = 'UPDATE users SET is_present = 1';

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        // 1. Delete all history
        db.query(resetLogs, (err) => {
            if (err) return db.rollback(() => res.status(500).json(err));

            // 2. Mark everyone as "In Hostel"
            db.query(resetUsers, (err) => {
                if (err) return db.rollback(() => res.status(500).json(err));

                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json(err));
                    console.log("⚠️ SYSTEM RESET COMPLETE");
                    res.json({ success: true, message: "System Wiped Clean" });
                });
            });
        });
    });
});
app.listen(3001, () => {
    console.log('🚀 Server running on port 3001');
});