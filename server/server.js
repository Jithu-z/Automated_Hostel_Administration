const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',     
    password: 'OPEN SQL', 
    database: 'hostel_os'
});

db.connect(err => {
    if (err) console.log('DB Connection Failed:', err);
    else console.log('Connected to MySQL');
});



app.post('/api/auth/login', (req, res) => {
    const { uid, password } = req.body;
    const sql = 'SELECT * FROM users WHERE uid = ? AND password_hash = ?';
    db.query(sql, [uid, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            res.json({ success: true, user: result[0] });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    });
});

app.get('/api/gate/status/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT is_present FROM users WHERE uid = ?';
    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ status: result[0].is_present ? 'in' : 'out' });
    });
});

//Rotating qr codes
let currentKioskCode = "INITIAL-CODE"; 

//Route for Kiosk to get a NEW code (Runs every 10s) 
app.get('/api/kiosk/update-code', (req, res) => {
    const newSeed = Math.random().toString(36).substring(7);
    const timestamp = new Date().getTime();
    currentKioskCode = `SECURE-${newSeed}-${timestamp}`;
    res.json({ success: true, code: currentKioskCode });
});

//Log Entry/Exit (The Check-In/Out Loop)
app.post('/api/gate/log', (req, res) => {
    const { student_id, action, reason, destination, qr_code } = req.body; 
    if (action === 'in') {
        if (qr_code !== currentKioskCode) {
            console.log("Security Alert: Invalid QR Code Scanned:", qr_code);
            return res.status(403).json({ 
                success: false, 
                message: "Security Alert: Invalid QR Code" 
            });
        }
    }
    const isPresent = action === 'in' ? 1 : 0;
    const dbStatus = action === 'in' ? 'returned' : 'out';
    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        // A. Insert into Logs
        // Note: We use 'exit_time' for OUT. For IN, we will update the 'actual_return' later. 
        // For simple Day 2 demo, we just log a new row for every action to keep it easy.
        const logSql = 'INSERT INTO gate_logs (uid, status, reason, destination) VALUES (?, ?, ?, ?)';
        
        db.query(logSql, [student_id, dbStatus, reason, destination || 'Returning'], (err, result) => {
        if (err) {
            console.error("SQL ERROR (Insert Log):", err.sqlMessage); 
            return db.rollback(() => res.status(500).json({ error: err.sqlMessage }));
        }

        const userSql = 'UPDATE users SET is_present = ? WHERE uid = ?';
        db.query(userSql, [isPresent, student_id], (err, result) => {
            if (err) {
                console.error("SQL ERROR (Update User):", err.sqlMessage);
                return db.rollback(() => res.status(500).json({ error: err.sqlMessage }));
            }
            
            db.commit(err => {
                if (err) return db.rollback(() => res.status(500).json(err));
                console.log("Transaction Committed Successfully!"); // Confirm success
                res.json({ success: true, new_status: action });
            });
        });
    });
    });
});

// Get recent logs for a SINGLE student
app.get('/api/student/logs/:uid', (req, res) => {
    const uid = req.params.uid;
    const sql = 'SELECT * FROM gate_logs WHERE uid = ? ORDER BY exit_time DESC LIMIT 5';
    
    db.query(sql, [uid], (err, result) => {
        if (err) {
            console.error("Error fetching logs:", err);
            return res.status(500).json(err);
        }
        res.json(result);
    });
});


//Warden Dashboard API

app.get('/api/warden/dashboard', (req, res) => {
    // 1. Get Count of Students currently OUT
    const countSql = 'SELECT COUNT(*) as out_count FROM users WHERE is_present = 0';
    // 2. Get Recent Logs (Joined with User Names)
    const logsSql = `
        SELECT gate_logs.*, users.full_name, users.uid 
        FROM gate_logs 
        JOIN users ON gate_logs.uid = users.uid 
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
                    total_students: 50 // Hardcoded for now,query count(*) from users
                },
                recent_logs: logsResult
            });
        });
    });
});

//Reset System 
app.post('/api/warden/reset', (req, res) => {
    const resetLogs = 'TRUNCATE table gate_logs'; 
    const resetUsers = 'UPDATE users SET is_present = 1';

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);
        db.query(resetLogs, (err) => {
            if (err) return db.rollback(() => res.status(500).json(err));
            db.query(resetUsers, (err) => {
                if (err) return db.rollback(() => res.status(500).json(err));
                db.commit(err => {
                    if (err) return db.rollback(() => res.status(500).json(err));
                    console.log("SYSTEM RESET COMPLETE");
                    res.json({ success: true, message: "System Wiped Clean" });
                });
            });
        });
    });
});

// Get list of all students currently OUT
app.get('/api/warden/out-list', (req, res) =>{
    const sql = "SELECT uid, full_name FROM users WHERE is_present = 0 ORDER BY full_name ASC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching out list:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});
app.listen(3001, () => {
    console.log('Server running on port 3001');
});