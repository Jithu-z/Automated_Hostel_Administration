const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const multer = require('multer');
const path = require('path');
const fs = require('fs');


const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 2. Configure Multer Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files here
    },
    filename: (req, file, cb) => {
        // Name file: uid-timestamp.jpg (to prevent duplicates)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 3. Serve the Uploads folder statically (Crucial for viewing images!)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.get('/api/kiosk/update-code', (req, res) => {
    const newSeed = Math.random().toString(36).substring(7);
    const timestamp = new Date().getTime();
    currentKioskCode = `SECURE-${newSeed}-${timestamp}`;
    res.json({ success: true, code: currentKioskCode });
});

//Log Entry/Exit
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


// student grievances api's
app.post('/api/student/grievances',upload.single('evidence'), (req, res) => {
    // Note: room_no comes from frontend (TO BE CHANGED LATER)
    const { uid, room_no, category, description } = req.body;
    const img_url = req.file ? `/uploads/${req.file.filename}` : null;
    const sql = "INSERT INTO grievances (uid, room_no, category, description, img_url) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [uid, room_no, category, description, img_url], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Grievance submitted" });
    });
});
app.get('/api/student/grievances/:uid', (req, res) => {
    const sql = "SELECT * FROM grievances WHERE uid = ? ORDER BY date_logged DESC";
    db.query(sql, [req.params.uid], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});
app.put('/api/student/grievances/acknowledge/:id', (req, res) => {
    const sql = "UPDATE grievances SET is_acknowledged = TRUE WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});



//Warden Dashboard API's

//Overnight stay Routes
app.get('/api/warden/dashboard', (req, res) => {
    const countSql = 'SELECT COUNT(*) as out_count FROM users WHERE is_present = 0';

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
    const sql = "SELECT uid, full_name, phone_no, address FROM users WHERE is_present = 0 ORDER BY full_name ASC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching out list:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

app.post('/api/warden/checkinOverride', (req, res) => {
    const { student_id, action, reason, destination } = req.body;
    const isPresent = action === 'returned' ? 1 : 0;

    db.beginTransaction(err => {
        if (err) return res.status(500).json(err);

        const logSql = 'INSERT INTO gate_logs (uid, status, reason, destination) VALUES (?, ?, ?, ?)';
        
        db.query(logSql, [student_id, action, reason, destination], (err, result) => {
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
                    res.json({ success: true, new_status: action });
                });
            });
        });
    });
});

//GRIEVANCE ROUTES

app.get('/api/warden/grievances', (req, res) => {
    const sql = `
      SELECT g.*, u.full_name 
      FROM grievances g 
      JOIN users u ON g.uid = u.uid 
      ORDER BY g.date_logged DESC
    `;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

app.put('/api/warden/grievances/:id', (req, res) => {
    const { status } = req.body; 
    const { id } = req.params;
    
    // CASE 1: Mark as RESOLVED (Delete Media + Update DB)
    if (status === 'Resolved') {
        // Step A: Find the file path first
        const selectSql = "SELECT img_url FROM grievances WHERE id = ?";
        db.query(selectSql, [id], (err, results) => {
            if (err) return res.status(500).json(err);
            
            // Step B: Delete the file if it exists
            if (results.length > 0 && results[0].img_url) {
                const fileName = path.basename(results[0].img_url); // Extract 'file.jpg' from '/uploads/file.jpg'
                const filePath = path.join(__dirname, 'uploads', fileName);

                fs.unlink(filePath, (err) => {
                    if (err) console.error("Warning: File not found or already deleted:", filePath);
                    else console.log("🗑️  Evidence deleted to save space:", fileName);
                });
            }
            // Step C: Update DB (Set status AND clear img_url)
            const updateSql = "UPDATE grievances SET status = ?, date_resolved = CURRENT_TIMESTAMP, img_url = NULL WHERE id = ?";
            db.query(updateSql, [status, id], (updateErr, result) => {
                if (updateErr) return res.status(500).json(updateErr);
                res.json({ success: true, message: "Resolved & Media Deleted" });
            });
        });

    } 
    // CASE 2: Other Status Updates (Pending/Assigned) - No Deletion
    else {
        const sql = "UPDATE grievances SET status = ? WHERE id = ?";
        db.query(sql, [status, id], (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true });
        });
    }
});

// 2. Clear All Resolved History
app.delete('/api/warden/grievances/clear-history', (req, res) => {
    const sql = "DELETE FROM grievances WHERE status = 'Resolved'";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "History cleared" });
    });
});

app.delete('/api/warden/grievances/:id', (req, res) => {
    const sql = "DELETE FROM grievances WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "Grievance deleted" });
    });
});

//Student Mabnagement Routes

// --- GET ALL STUDENTS (With Checkout Counts) ---
app.get('/api/warden/students', (req, res) => {
    const sql = `
        SELECT 
            u.uid, 
            u.full_name, 
            u.room_no, 
            u.phone_no, 
            u.address,
            u.password_hash as dob, 
            (SELECT COUNT(*) FROM gate_logs WHERE uid = u.uid AND status = 'out') as checkout_count
        FROM users u where u.role = 'student'
        ORDER BY u.room_no ASC;
        
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

-
app.put('/api/warden/students/:uid', (req, res) => {
    const { uid } = req.params;
    const { full_name, room_no, phone_no, address, dob } = req.body;
    
    const sql = "UPDATE users SET full_name=?, room_no=?, phone_no=?, address=?, password_hash=? WHERE uid=?";
    
    db.query(sql, [full_name, room_no, phone_no, address, dob, uid], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});