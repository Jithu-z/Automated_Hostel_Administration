const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

// This cron expression means: "At 00:01 (12:01 AM) on Monday (day 1)"
cron.schedule('1 0 * * 1', () => {
    console.log("⏰ Running automated weekly menu sync...");

    const sql = `
        INSERT INTO daily_menu (serve_date, meal_type, dish_id, status)
        SELECT 
            DATE_ADD(serve_date, INTERVAL 7 DAY), 
            meal_type, 
            dish_id, 
            'Approved'
        FROM daily_menu
        WHERE serve_date BETWEEN CURDATE() - INTERVAL 7 DAY AND CURDATE() - INTERVAL 1 DAY
    `;

    db.query(sql, (err, result) => {
        if (err) {
            console.error("❌ CRON ERROR: Failed to clone weekly menu:", err);
        } else {
            console.log(`✅ CRON SUCCESS: Cloned ${result.affectedRows} meals for the new week!`);
        }
    });
});
// Run on the 1st of every month at 2:00 AM
cron.schedule('0 2 1 * *', () => {
    console.log("🧹 Running monthly database cleanup...");

    // Delete menus older than 6 months (approx 180 days)
    const sql = `DELETE FROM daily_menu WHERE serve_date < CURDATE() - INTERVAL 6 MONTH`;

    db.query(sql, (err, result) => {
        if (err) {
            console.error("❌ CLEANUP ERROR:", err);
        } else {
            console.log(`✅ CLEANUP SUCCESS: Purged ${result.affectedRows} old menu records.`);
        }
    });
});
// Run every night at 2:00 AM to calculate Bayesian Popularity
cron.schedule('0 2 * * *', () => {
    console.log("🧮 Running Nightly Bayesian Popularity Calculation...");

    // 1. Get all dishes and their reviews
    const fetchReviewsSql = `
        SELECT 
            mc.id AS dish_id,
            COUNT(mr.id) AS real_votes,
            COALESCE(AVG(mr.rating), 0) AS real_avg
        FROM menu_catalog mc
        LEFT JOIN daily_menu dm ON mc.id = dm.dish_id
        LEFT JOIN mess_reviews mr 
            ON dm.serve_date = mr.serve_date 
            AND dm.meal_type = mr.meal_type
            AND (mc.diet_type = mr.diet_type OR mc.diet_type = 'Common')
        GROUP BY mc.id
    `;

    db.query(fetchReviewsSql, (err, dishes) => {
        if (err) return console.error("❌ Failed to fetch reviews for math:", err);

        // 2. The Bayesian Constants you defined
        const C = 10;   // Dummy votes
        const m = 3.5;  // Baseline score

        // 3. Calculate and Update each dish
        dishes.forEach(dish => {
            // Your exact formula translated to code:
            const realSum = dish.real_votes * dish.real_avg;
            const dummySum = C * m;
            const totalVotes = dish.real_votes + C;
            
            // Calculate and round to 2 decimal places
            const finalScore = ((realSum + dummySum) / totalVotes).toFixed(2);

            // 4. Save it back to the catalog
            const updateSql = `UPDATE menu_catalog SET popularity_score = ? WHERE id = ?`;
            db.query(updateSql, [finalScore, dish.dish_id], (updateErr) => {
                if (updateErr) console.error(`❌ Failed to update dish ${dish.dish_id}`);
            });
        });
        
        console.log("✅ All dishes updated with true Bayesian scores!");
    });
});



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
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyAZRbNtGb9KDTCXH3DvXQ3emnEjRxIPrHk");



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
// 📺 KIOSK DISPLAY API: Real-time Mess Hall Data
app.get('/api/kiosk/live-display', async (req, res) => {
    try {
        // 1. Get Today's Live Review Stats
        const statsSql = `
            SELECT 
                COUNT(*) AS total_votes_today,
                COALESCE(AVG(rating), 0) AS average_rating_today
            FROM mess_reviews 
            WHERE serve_date = CURDATE()
        `;

        // 2. Get Today's Menu sorted by your Bayesian Popularity Score
        const menuSql = `
            SELECT 
                mc.dish_name, 
                mc.diet_type, 
                mc.popularity_score,
                dm.meal_type
            FROM daily_menu dm
            JOIN menu_catalog mc ON dm.dish_id = mc.id
            WHERE dm.serve_date = CURDATE() AND dm.status = 'Approved'
            ORDER BY mc.popularity_score DESC
        `;

        // Run both queries in parallel for maximum speed
        const [statsResult] = await db.promise().query(statsSql);
        const [menuResult] = await db.promise().query(menuSql);

        // Group the menu by meal type for easy display
        const todayMenu = {
            Breakfast: menuResult.filter(m => m.meal_type === 'Breakfast'),
            Lunch: menuResult.filter(m => m.meal_type === 'Lunch'),
            Dinner: menuResult.filter(m => m.meal_type === 'Dinner')
        };

        // Determine active meal based on the current hour
        const currentHour = new Date().getHours();
        let activeMeal = 'Breakfast';
        if (currentHour >= 11 && currentHour < 16) activeMeal = 'Lunch';
        if (currentHour >= 16) activeMeal = 'Dinner';

        // 3. Assemble the JSON payload for the Kiosk Team
        res.json({
            timestamp: new Date().toISOString(),
            active_meal: activeMeal,
            live_stats: {
                total_votes: statsResult[0].total_votes_today,
                average_rating: Number(statsResult[0].average_rating_today).toFixed(1)
            },
            trending_today: menuResult.slice(0, 3), // Top 3 highest rated dishes today
            full_menu: todayMenu
        });

    } catch (err) {
        console.error("❌ Kiosk API Error:", err);
        res.status(500).json({ error: "Failed to fetch live kiosk data" });
    }
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
          AND mc.diet_type IN (?, 'Common') 
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
app.get('/api/warden/overnightlog', async (req, res) => {
    try {
        // Run all three queries in parallel
        const [outResult, totalResult, logsResult] = await Promise.all([
            db.promise().query("SELECT COUNT(*) as out_count FROM users WHERE role = 'student' AND is_present = 0"),
            db.promise().query("SELECT COUNT(*) as total_count FROM users WHERE role = 'student'"),
            db.promise().query(`
                SELECT gate_logs.*, users.full_name, users.uid 
                FROM gate_logs 
                JOIN users ON gate_logs.uid = users.uid 
                ORDER BY exit_time DESC 
                LIMIT 10
            `)
        ]);

        res.json({
            stats: {
                out_now: outResult[0][0].out_count,
                total_students: totalResult[0][0].total_count
            },
            recent_logs: logsResult[0] // Returns the array of log rows
        });

    } catch (err) {
        console.error("❌ Overnight Log Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch overnight logs" });
    }
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

// app.get('/api/warden/home-stats', (req, res) => {
//     const stats = {};

//     const q1 = "SELECT COUNT(*) as count FROM users";
    
//     const q2 = "SELECT COUNT(*) as count FROM grievances WHERE status != 'Resolved'";
//     const q3 = `
//         SELECT COUNT(*) as count FROM (
//             SELECT uid, 
//                    SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY exit_time DESC), ',', 1) as last_action
//             FROM gate_logs 
//             GROUP BY uid
//         ) as status_table 
//         WHERE last_action = 'out'
//     `;

//     db.query(q1, (err, r1) => {
//         if(err) {
//             console.error("Stats Error (Users):", err);
//             return res.status(500).json(err);
//         }
//         stats.total_students = r1[0].count;

//         db.query(q2, (err, r2) => {
//             if(err) {
//                 console.error("Stats Error (Grievances):", err);
//                 return res.status(500).json(err);
//             }
//             stats.pending_grievances = r2[0].count;

//             db.query(q3, (err, r3) => {
//                 if(err) {
//                     console.error("Stats Error (Gate):", err);
//                     return res.status(500).json(err);
//                 }
//                 stats.students_out = r3[0].count;
                
//                 // Final Response
//                 // Note: 'mess_rating' and 'top_complaint' are handled by Frontend defaults 
//                 // until the AI module is ready, sending the hard numbers here.
//                 res.json(stats);
//             });
//         });
//     });
// });
// LIVE HOME STATS
app.get('/api/warden/home-stats', async (req, res) => {
    try {
        // Run all 4 queries in parallel for maximum speed
        const [outResult, grievanceResult, totalStudents, messResult] = await Promise.all([
            db.promise().query("SELECT COUNT(*) as count FROM users WHERE role = 'student' AND is_present = 0"),
            // Assuming your grievances table has a status column. Adjust if yours is named differently!
            db.promise().query("SELECT COUNT(*) as count FROM grievances WHERE status = 'Pending'"),
            db.promise().query("SELECT COUNT(*) as count FROM users WHERE role = 'student'"),
            db.promise().query("SELECT COALESCE(AVG(rating), 0) as avg_rating FROM mess_reviews WHERE serve_date = CURDATE()")
        ]);

        res.json({
            students_out: outResult[0][0].count,
            pending_grievances: grievanceResult[0][0].count,
            total_students: totalStudents[0][0].count,
            mess_rating: Number(messResult[0][0].avg_rating).toFixed(1)
        });
    } catch (err) {
        console.error("❌ Home Stats Error:", err);
        res.status(500).json({ error: "Failed to fetch live stats" });
    }
});


// Menu Routes
// 1. GET: Fetch the entire Menu Catalog
app.get('/api/admin/menu-catalog', (req, res) => {
    const sql = `
        SELECT 
            mc.id, 
            mc.dish_name, 
            mc.diet_type, 
            mc.cost, 
            mc.effort_score, 
            mc.popularity_score,
            GROUP_CONCAT(DISTINCT dm.meal_type) as served_meals
        FROM menu_catalog mc
        LEFT JOIN daily_menu dm ON mc.id = dm.dish_id
        GROUP BY mc.id
        ORDER BY mc.diet_type ASC, mc.dish_name ASC
    `;
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. POST: Add a brand new dish to the Menu Catalog (WITH DUPLICATE PREVENTION)
app.post('/api/admin/menu-catalog', (req, res) => {
    const { dish_name, diet_type, cost, effort_score } = req.body;

    // Step 1: Check if a dish with the exact same name already exists
    const checkSql = "SELECT id FROM menu_catalog WHERE LOWER(dish_name) = LOWER(?)";
    
    db.query(checkSql, [dish_name], (err, results) => {
        if (err) {
            console.error("Error checking for duplicate:", err);
            return res.status(500).json({ error: "Database error" });
        }

        // If results > 0, the dish is already in the database!
        if (results.length > 0) {
            return res.status(409).json({ error: `"${dish_name}" is already in your catalog!` });
        }

        // Step 2: If it does not exist, insert it normally
        const insertSql = "INSERT INTO menu_catalog (dish_name, diet_type, cost, effort_score) VALUES (?, ?, ?, ?)";
        db.query(insertSql, [dish_name, diet_type, cost, effort_score], (insertErr, result) => {
            if (insertErr) {
                console.error("Error adding dish:", insertErr);
                return res.status(500).json({ error: "Failed to add dish" });
            }
            res.json({ success: true, message: "Dish added to catalog!", id: result.insertId });
        });
    });
});
// 2b. DELETE: Remove a dish from the Menu Catalog
app.delete('/api/admin/menu-catalog/:id', (req, res) => {
    const dishId = req.params.id;
    const sql = "DELETE FROM menu_catalog WHERE id = ?";
    
    db.query(sql, [dishId], (err, result) => {
        if (err) {
            // Error 1451 means "Cannot delete because another table is using this ID"
            if (err.errno === 1451) {
                return res.status(409).json({ error: "Cannot delete this dish because it is currently scheduled on the menu. Please remove it from the weekly schedule first." });
            }
            console.error("Error deleting catalog item:", err);
            return res.status(500).json({ error: "Failed to delete dish" });
        }
        res.json({ success: true, message: "Dish removed from catalog!" });
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

//9. POST: Auto generate menu ai
app.post('/api/admin/ai-generate-menu', async (req, res) => {
    const { start_date, end_date, custom_prompt } = req.body;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: "Start and End dates are required." });
    }

    try {
        // 1. Fetch the exact menu catalog from your database
const [catalog] = await db.promise().query("SELECT id, dish_name, diet_type, cost, effort_score, popularity_score FROM menu_catalog");        
        if (catalog.length === 0) {
            return res.status(400).json({ error: "Menu catalog is empty. Add dishes first!" });
        }

        // 2. Construct the strict AI Prompt
        const systemPrompt = `
        You are an expert Hostel Mess Manager and Nutritionist. 
        Your job is to generate a weekly menu schedule from ${start_date} to ${end_date}.
        
        Here is the ONLY catalog of dishes you are allowed to use. Do NOT invent new dishes:
        ${JSON.stringify(catalog, null, 2)}

        RULES:
        1. Every single date between ${start_date} and ${end_date} must have exactly three meal types: "Breakfast", "Lunch", and "Dinner".
        2. For each meal, you must select at least ONE "Veg" or "Common" dish, AND at least ONE "Non-Veg" dish (unless the custom prompt says otherwise).
        3. Balance the 'cost' and 'effort_score' so the kitchen isn't overworked on any single day.
        4. Do not serve the same exact meal two days in a row.
        5. 5. MAXIMIZE STUDENT HAPPINESS: Prioritize dishes with a high 'popularity_score'. If you must schedule a high-effort or high-cost dish, ensure its popularity justifies it.
        6. The Warden provided these custom instructions: "${custom_prompt || 'Balance cost and nutrition.'}"

        OUTPUT FORMAT:
        You must return ONLY a raw JSON array of objects. No markdown formatting, no \`\`\`json blocks, no explanations. Just the array.
        Example format:
        [
          { "serve_date": "YYYY-MM-DD", "meal_type": "Breakfast", "dish_id": 15 },
          { "serve_date": "YYYY-MM-DD", "meal_type": "Breakfast", "dish_id": 22 }
        ]
        `;

        // 3. Call the AI Model
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(systemPrompt);
        let aiResponse = result.response.text();

        // 4. Clean the response (AI sometimes adds markdown ticks even when told not to)
        aiResponse = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        // 5. Parse and send back to frontend
        const generatedMenu = JSON.parse(aiResponse);
        res.json({ success: true, proposed_menu: generatedMenu });

    } catch (err) {
        console.error("AI Generation Error:", err);
        res.status(500).json({ error: "The AI failed to generate the menu. Please try again." });
    }
});





// WARDEN MESS REVIEWS API
// GET: Fetch all student mess reviews for the Analytics Dashboard
app.get('/api/admin/mess-reviews', (req, res) => {
    const sql = `
        SELECT id, uid, serve_date, meal_type, diet_type, rating, dish_issues, comment, created_at 
        FROM mess_reviews 
        ORDER BY created_at DESC, serve_date DESC`;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching reviews:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});
// 🧠 GENERATE AI INSIGHTS FROM REVIEWS
app.post('/api/admin/generate-insights', async (req, res) => {
    const { reviews, stats } = req.body;

    if (!reviews || reviews.length === 0) {
        return res.status(400).json({ error: "No reviews to analyze." });
    }

    try {
        const systemPrompt = `
        You are an expert Data Analyst for a University Hostel Mess.
        Analyze this batch of ${stats.total} student reviews (Average Rating: ${stats.avg} Stars).
        
        Raw Data:
        ${JSON.stringify(reviews.slice(0, 100))} // Limit to 100 to save tokens

        Provide a strict 3-bullet point executive summary of the biggest trends or issues. 
        Format as plain text bullets (using •). Keep it concise, actionable, and focus heavily on the 'dish_issues' and 'comments'.
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(systemPrompt);
        
        res.json({ success: true, summary: result.response.text() });
    } catch (err) {
        console.error("AI Insight Error:", err);
        res.status(500).json({ error: "Failed to generate insights." });
    }
});
















// 🛠️ TEMPORARY ROUTE TO FORCE BAYESIAN CALCULATION 🛠️
app.get('/api/admin/force-popularity-sync', (req, res) => {
    console.log("🧮 Running Manual Nightly Bayesian Popularity Calculation...");

    // 1. Get all dishes and their reviews using the correct temporal JOIN
    const fetchReviewsSql = `
        SELECT 
            mc.id AS dish_id,
            COUNT(mr.id) AS real_votes,
            COALESCE(AVG(mr.rating), 0) AS real_avg
        FROM menu_catalog mc
        LEFT JOIN daily_menu dm ON mc.id = dm.dish_id
        LEFT JOIN mess_reviews mr 
            ON dm.serve_date = mr.serve_date 
            AND dm.meal_type = mr.meal_type
            AND (mc.diet_type = mr.diet_type OR mc.diet_type = 'Common')
        GROUP BY mc.id
    `;

    db.query(fetchReviewsSql, (err, dishes) => {
        if (err) {
            console.error("❌ Failed to fetch reviews for math:", err);
            return res.status(500).json({ error: "Failed to fetch reviews", mysql_error: err.sqlMessage }); 
        }

        if (dishes.length === 0) {
            return res.json({ success: true, message: "No dishes to update." });
        }

        // 2. The Bayesian Constants
        const C = 10;   // Dummy votes
        const m = 3.5;  // Baseline score
        let completedUpdates = 0; 

        // 3. Calculate and Update each dish
        dishes.forEach(dish => {
            const realSum = dish.real_votes * dish.real_avg;
            const dummySum = C * m;
            const totalVotes = dish.real_votes + C;
            
            // Calculate and round to 2 decimal places
            const finalScore = ((realSum + dummySum) / totalVotes).toFixed(2);

            // 4. Save it back to the catalog
            const updateSql = `UPDATE menu_catalog SET popularity_score = ? WHERE id = ?`;
            db.query(updateSql, [finalScore, dish.dish_id], (updateErr) => {
                if (updateErr) console.error(`❌ Failed to update dish ${dish.dish_id}`);
                
                completedUpdates++;
                
                // 5. Send success response only when all updates finish
                if (completedUpdates === dishes.length) {
                    console.log("✅ All dishes updated with true Bayesian scores!");
                    res.json({ 
                        success: true, 
                        message: `Successfully calculated and updated ${dishes.length} dishes! Check your Warden Dashboard.` 
                    });
                }
            });
        });
    });
});

// 🛠️ TEMPORARY TEST ROUTE 1: Fetch Menu by Specific Date
app.get('/api/student/mess/test/menu', (req, res) => {
    const { date, meal, diet } = req.query;
    const sql = `
        SELECT mc.id, mc.dish_name, mc.diet_type 
        FROM daily_menu dm
        JOIN menu_catalog mc ON dm.dish_id = mc.id
        WHERE dm.serve_date = ? 
          AND dm.meal_type = ?
          AND mc.diet_type IN (?, 'Common')
          AND dm.status = 'Approved'
    `;
    db.query(sql, [date, meal, diet], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 🛠️ TEMPORARY TEST ROUTE 2: Submit Review for Specific Date
app.post('/api/student/mess/test/review', (req, res) => {
    const { uid, serve_date, meal_type, diet_type, rating, dish_issues, comment } = req.body;
    const sql = `
        INSERT INTO mess_reviews (uid, serve_date, meal_type, diet_type, rating, dish_issues, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(sql, [uid, serve_date, meal_type, diet_type, rating, dish_issues, comment], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
app.listen(3001, () => {
    console.log('Server running on port 3001');
});