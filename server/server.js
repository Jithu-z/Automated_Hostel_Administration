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
    database: 'hostel_os',
    dateStrings: true
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
    const sql = "UPDATE grievances SET is_acknowledged = 1 WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

//student mess review api's
// GET: Fetch today's menu for a specific meal AND diet type
app.get('/api/student/mess/today', (req, res) => {
    const mealType = req.query.meal; // 'Breakfast', 'Lunch', or 'Dinner'
    const dietType = req.query.diet; // 'Veg' or 'Non-Veg'

    // Safety check
    if (!mealType || !dietType) {
        return res.status(400).json({ error: "Missing meal or diet parameter" });
    }

    // Join daily_menu with menu_catalog and filter by BOTH meal_type and mc.type (diet)
    const sql = `
        SELECT mc.id, mc.dish_name, mc.diet_type 
        FROM daily_menu dm
        JOIN menu_catalog mc ON dm.dish_id = mc.id
        WHERE dm.serve_date = CURDATE() 
          AND dm.meal_type = ?
          AND mc.diet_type = ?
          AND dm.status = 'Approved'
    `;

    db.query(sql, [mealType, dietType], (err, results) => {
        if (err) {
            console.error("Error fetching today's menu:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});
// POST: Submit a new mess review
app.post('/api/student/mess/review', (req, res) => {
    const { uid, meal_type, diet_type, rating, dish_issues, comment } = req.body;
    const sql = `
        INSERT INTO mess_reviews 
        (uid, serve_date, meal_type, diet_type, rating, dish_issues, comment) 
        VALUES (?, CURDATE(), ?, ?, ?, ?, ?)`;
    db.query(sql, [uid, meal_type, diet_type, rating, dish_issues, comment], (err, result) => {
        if (err) {
            console.error("Error saving mess review:", err.sqlMessage || err);
            return res.status(500).json({ error: "Failed to save review" });
        }
        console.log(`[Mess] Review logged by ${uid} for ${diet_type} ${meal_type}. Rating: ${rating}★`);
        res.json({ success: true, message: "Review saved successfully", review_id: result.insertId });
    });
});
// GET: Check which meals the student has already reviewed today
app.get('/api/student/mess/reviewed-today', (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    const sql = `
        SELECT meal_type 
        FROM mess_reviews 
        WHERE uid = ? AND serve_date = CURDATE()
    `;
    
    db.query(sql, [uid], (err, results) => {
        if (err) {
            console.error("Error checking reviews:", err);
            return res.status(500).json({ error: "Database error" });
        }
        // Returns a simple array like: ['Breakfast', 'Lunch']
        const reviewedMeals = results.map(row => row.meal_type);
        res.json(reviewedMeals);
    });
});


// ==========================================
// WARDEN MENU DASHBOARD APIs
// ==========================================


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


//DashboardHome Routes

app.get('/api/warden/home-stats', (req, res) => {
    const stats = {};

    const q1 = "SELECT COUNT(*) as count FROM users";
    
    const q2 = "SELECT COUNT(*) as count FROM grievances WHERE status != 'Resolved'";
    const q3 = `
        SELECT COUNT(*) as count FROM (
            SELECT uid, 
                   SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY exit_time DESC), ',', 1) as last_action
            FROM gate_logs 
            GROUP BY uid
        ) as status_table 
        WHERE last_action = 'out'
    `;

    db.query(q1, (err, r1) => {
        if(err) {
            console.error("Stats Error (Users):", err);
            return res.status(500).json(err);
        }
        stats.total_students = r1[0].count;

        db.query(q2, (err, r2) => {
            if(err) {
                console.error("Stats Error (Grievances):", err);
                return res.status(500).json(err);
            }
            stats.pending_grievances = r2[0].count;

            db.query(q3, (err, r3) => {
                if(err) {
                    console.error("Stats Error (Gate):", err);
                    return res.status(500).json(err);
                }
                stats.students_out = r3[0].count;
                
                // Final Response
                // Note: 'mess_rating' and 'top_complaint' are handled by Frontend defaults 
                // until the AI module is ready, sending the hard numbers here.
                res.json(stats);
            });
        });
    });
});


// Menu Routes
// 1. GET: Fetch the entire Menu Catalog
app.get('/api/admin/menu-catalog', (req, res) => {
    const sql = "SELECT * FROM menu_catalog ORDER BY diet_type, dish_name";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching catalog:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 2. POST: Add a brand new dish to the Menu Catalog
app.post('/api/admin/menu-catalog', (req, res) => {
    const { dish_name, diet_type, cost, effort_score } = req.body;
    const sql = "INSERT INTO menu_catalog (dish_name, diet_type, cost, effort_score) VALUES (?, ?, ?, ?)";
    
    db.query(sql, [dish_name, diet_type, cost, effort_score], (err, result) => {
        if (err) {
            console.error("Error adding dish:", err);
            return res.status(500).json({ error: "Failed to add dish" });
        }
        res.json({ success: true, message: "Dish added to catalog!", id: result.insertId });
    });
});

// 3. GET: Fetch the planned menu for a specific date
app.get('/api/admin/daily-menu/:date', (req, res) => {
    const serveDate = req.params.date; // Format: YYYY-MM-DD
    
    const sql = `
        SELECT d.id, d.meal_type, m.dish_name, m.diet_type 
        FROM daily_menu d
        JOIN menu_catalog m ON d.dish_id = m.id
        WHERE d.serve_date = ?
    `;
    
    db.query(sql, [serveDate], (err, results) => {
        if (err) {
            console.error("Error fetching daily menu:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 4. POST: Assign a dish from the catalog to a specific meal schedule
app.post('/api/admin/daily-menu', (req, res) => {
    const { serve_date, meal_type, dish_id } = req.body;
    const sql = "INSERT INTO daily_menu (serve_date, meal_type, dish_id) VALUES (?, ?, ?)";
    
    db.query(sql, [serve_date, meal_type, dish_id], (err, result) => {
        if (err) {
            console.error("Error scheduling dish:", err);
            return res.status(500).json({ error: "Failed to schedule dish" });
        }
        res.json({ success: true, message: "Dish scheduled successfully!" });
    });
});

// 5. GET: Fetch the planned menu for a specific date range (e.g., a full week)
app.get('/api/admin/weekly-menu', (req, res) => {
    // We expect the frontend to pass these as query parameters
    // Example: /api/admin/weekly-menu?start=2026-03-02&end=2026-03-08
    const startDate = req.query.start;
    const endDate = req.query.end;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "Please provide both start and end dates." });
    }

    // The SQL Query
    // - We use BETWEEN to grab the whole week in one go.
    // - We use FIELD() to ensure the database returns the meals in chronological order,
    //   making it infinitely easier for your React frontend to map them into the grid.
    const sql = `
        SELECT 
            d.id as schedule_id, 
            d.serve_date, 
            d.meal_type, 
            d.dish_id,
            d.status, 
            m.dish_name, 
            m.diet_type 
        FROM daily_menu d
        JOIN menu_catalog m ON d.dish_id = m.id
        WHERE d.serve_date BETWEEN ? AND ?
        ORDER BY 
            d.serve_date ASC, 
            FIELD(d.meal_type, 'Breakfast', 'Lunch', 'Dinner')
    `;

    db.query(sql, [startDate, endDate], (err, results) => {
        if (err) {
            console.error("Error fetching weekly menu:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 5. DELETE: Remove a scheduled dish from the daily menu
app.delete('/api/admin/daily-menu/:id', (req, res) => {
    const scheduleId = req.params.id; // This is the unique ID of the scheduled slot, not the dish catalog ID
    const sql = "DELETE FROM daily_menu WHERE id = ?";
    
    db.query(sql, [scheduleId], (err, result) => {
        if (err) {
            console.error("Error deleting scheduled dish:", err);
            return res.status(500).json({ error: "Failed to delete dish" });
        }
        res.json({ success: true, message: "Dish removed from schedule!" });
    });
});

// 6. GET: Fetch all meal timings
app.get('/api/admin/meal-timings', (req, res) => {
    const sql = "SELECT * FROM meal_timings";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching timings:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        // Convert the MySQL array into a clean object for React
        // MySQL sends 'HH:MM:SS', we slice it to 'HH:MM' for the HTML time inputs
        const timingsObj = {};
        results.forEach(row => {
            timingsObj[row.meal_type] = {
                start: row.start_time.substring(0, 5), 
                end: row.end_time.substring(0, 5)
            };
        });
        res.json(timingsObj);
    });
});

// 7. PUT: Update a specific meal timing
app.put('/api/admin/meal-timings', (req, res) => {
    const { meal_type, start_time, end_time } = req.body;
    const sql = "UPDATE meal_timings SET start_time = ?, end_time = ? WHERE meal_type = ?";
    
    db.query(sql, [start_time, end_time, meal_type], (err, result) => {
        if (err) {
            console.error("Error updating timing:", err);
            return res.status(500).json({ error: "Failed to update timing" });
        }
        res.json({ success: true, message: "Timing updated successfully!" });
    });
});

// 8. PUT: Approve the menu for a specific date range
app.put('/api/admin/daily-menu/approve', (req, res) => {
    const { start_date, end_date } = req.body;
    
    // Updates all meals in this week to 'Approved'
    const sql = "UPDATE daily_menu SET status = 'Approved' WHERE serve_date BETWEEN ? AND ?";
    
    db.query(sql, [start_date, end_date], (err, result) => {
        if (err) {
            console.error("Error approving menu:", err);
            return res.status(500).json({ error: "Failed to approve menu" });
        }
        res.json({ success: true, message: "Weekly menu approved successfully!" });
    });
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});