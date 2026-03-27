const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');
const app = express();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
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

// Run every night at 2:00 AM to calculate Bayesian Popularity + Flag Penalties
cron.schedule('0 2 * * *', async () => {
    console.log("🧮 CRON: Running Nightly Math Engine (Bayesian + Penalties)...");
    try {
        const fetchReviewsSql = `
            SELECT 
                mc.id AS dish_id,
                mc.dish_name,
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

        const fetchIssuesSql = `SELECT dish_issues FROM mess_reviews WHERE dish_issues IS NOT NULL AND dish_issues != '{}'`;

        const [dishes] = await db.promise().query(fetchReviewsSql);
        const [issues] = await db.promise().query(fetchIssuesSql);

        const flagDictionary = {};

        if (dishes.length === 0) return console.log("🧮 CRON: No dishes to update.");

        issues.forEach(row => {
            try {
                const parsed = typeof row.dish_issues === 'string' ? JSON.parse(row.dish_issues) : row.dish_issues;
                Object.entries(parsed).forEach(([dishName, tags]) => {
                    if (!flagDictionary[dishName]) flagDictionary[dishName] = 0;
                    flagDictionary[dishName] += tags.length; 
                });
            } catch (e) {}
        });

        const splitDishName = (name) => {
            if (!name) return [];
            return name.split(/ \+ | & | and |, /i).map(s => s.trim()).filter(Boolean);
        };

        const C = 10;   
        const m = 3.5;  
        const PENALTY_PER_FLAG = 0.15; 
        let completedUpdates = 0; 

        dishes.forEach(dish => {
            const realSum = dish.real_votes * dish.real_avg;
            const dummySum = C * m;
            const totalVotes = dish.real_votes + C;
            let score = (realSum + dummySum) / totalVotes;
            const subItems = splitDishName(dish.dish_name);
            let totalFlagsForDish = 0;

            subItems.forEach(subItem => {
                if (flagDictionary[subItem]) totalFlagsForDish += flagDictionary[subItem];
            });

            const totalPenalty = totalFlagsForDish * PENALTY_PER_FLAG;
            score = score - totalPenalty;

            if (score < 1.0) score = 1.0;
            if (score > 5.0) score = 5.0;

            const finalScore = score.toFixed(2);

            const updateSql = `UPDATE menu_catalog SET popularity_score = ? WHERE id = ?`;
            db.query(updateSql, [finalScore, dish.dish_id], (updateErr) => {                
                completedUpdates++;
                if (completedUpdates === dishes.length) {
                    console.log("✅ CRON: All dishes updated with Penalty-Adjusted scores!");
                }
                if (updateErr) console.error(`❌ CRON: Failed to update dish ${dish.dish_id}`);
            });
        });

    } catch (err) {
        console.error("❌ CRON Math Engine Error:", err);
    }
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
const uploadCsv = multer({ storage: multer.memoryStorage() });

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
const genAI = new GoogleGenerativeAI("PASTE API KEY KERE");


// ==========================================
// 🏢 HOSTEL CONFIGURATION
// ==========================================
const HOSTEL_CONFIG = {
    roomRegex: /^[A-Z]-\d+$/i, 
    allowedBranches: [
        'CSE', 'CIVIL', 'MECHANICAL', 
        'ELECTRICAL', 'ECE', 'IT', 'AIDS'
    ]
};

// ==========================================
// KIOSK APIs
// ==========================================
//Rotating qr codes
let currentKioskCode = "INITIAL-CODE"; 

app.get('/api/kiosk/update-code', (req, res) => {
    const newSeed = Math.random().toString(36).substring(7);
    const timestamp = new Date().getTime();
    currentKioskCode = `SECURE-${newSeed}-${timestamp}`;
    res.json({ success: true, code: currentKioskCode });
});


app.get('/api/kiosk/live-display', async (req, res) => {
    try {
        // 1. Overall live stats for the entire day (Summary)
        // 1. Overall live stats for the entire day (Summary)
        const statsSql = `
            SELECT 
                COUNT(*) AS total_votes_today,
                COALESCE(AVG(rating), 0) AS average_rating_today
            FROM mess_reviews 
            WHERE serve_date = CURDATE()
        `;

        // 2. Today's Menu sorted by Bayesian Popularity Score
        // 2. Today's Menu sorted by Bayesian Popularity Score
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

        // 3. Live ratings and vote counts grouped by specific meal
        const mealStatsSql = `
            SELECT 
                meal_type, 
                COUNT(*) as vote_count, 
                COALESCE(AVG(rating), 0) as live_rating 
            FROM mess_reviews 
            WHERE serve_date = CURDATE() 
            GROUP BY meal_type
        `;

        // 4. The Hall of Fame Query (Top 3 All-Time per meal type)
        const hofSql = `
            SELECT mc.dish_name, mc.popularity_score, mc.diet_type
            FROM menu_catalog mc
            JOIN daily_menu dm ON mc.id = dm.dish_id
            WHERE dm.meal_type = ?
            GROUP BY mc.id
            ORDER BY mc.popularity_score DESC
            LIMIT 3
        `;

        // 5. Fetch Meal Timings from the database
        const timingsSql = `SELECT meal_type, start_time, end_time FROM meal_timings`;

        // Run EVERYTHING in parallel for maximum speed
        const [
            [statsResult], 
            [menuResult], 
            [mealStatsResult],
            [hofBreakfast], 
            [hofLunch], 
            [hofDinner],
            [timingsResult]
        ] = await Promise.all([
            db.promise().query(statsSql),
            db.promise().query(menuSql),
            db.promise().query(mealStatsSql),
            db.promise().query(hofSql, ['Breakfast']),
            db.promise().query(hofSql, ['Lunch']),
            db.promise().query(hofSql, ['Dinner']),
            db.promise().query(timingsSql) 
        ]);

        // Helper function to extract the live stats for a specific meal type
        const getMealStats = (mealType) => {
            const stat = mealStatsResult.find(m => m.meal_type === mealType);
            return {
                live_rating: stat ? Number(stat.live_rating).toFixed(1) : "0.0",
                votes: stat ? stat.vote_count : 0
            };
        };

        // Helper function to extract timings
        const getTimings = (mealType) => {
            const timing = timingsResult.find(t => t.meal_type === mealType);
            return timing ? { start_time: timing.start_time, end_time: timing.end_time } : null;
        };

        // Group today's menu AND attach their live rating, vote count, and timings!
        const todayMenu = {
            Breakfast: {
                timings: getTimings('Breakfast'),
                ...getMealStats('Breakfast'),
                items: menuResult.filter(m => m.meal_type === 'Breakfast')
            },
            Lunch: {
                timings: getTimings('Lunch'),
                ...getMealStats('Lunch'),
                items: menuResult.filter(m => m.meal_type === 'Lunch')
            },
            Dinner: {
                timings: getTimings('Dinner'),
                ...getMealStats('Dinner'),
                items: menuResult.filter(m => m.meal_type === 'Dinner')
            }
        };

        // ✨ UPGRADED: CONTINUOUS ROLLOVER LOGIC (Based on Start Times)
        const timeToMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const parts = timeStr.toString().split(':');
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        };

        // 🚨 IMPORTANT: Forces the server to calculate using Indian Standard Time (IST)
        const now = new Date();
        const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const currentMinutes = istTime.getHours() * 60 + istTime.getMinutes();
        
        // Extract start times (fallback to standard times if DB is missing values)
        const bfastStart = timeToMinutes(todayMenu.Breakfast.timings?.start_time || '07:00:00');
        const lunchStart = timeToMinutes(todayMenu.Lunch.timings?.start_time || '12:00:00');
        const dinnerStart = timeToMinutes(todayMenu.Dinner.timings?.start_time || '19:00:00');

        let activeMeal = 'Dinner'; 

        // Logic exactly as requested:
        if (currentMinutes >= dinnerStart) {
            // From dinner start time until midnight -> Dinner
            activeMeal = 'Dinner';     
        } else if (currentMinutes >= lunchStart) {
            // From lunch start time until dinner starts -> Lunch
            activeMeal = 'Lunch';      
        } else if (currentMinutes >= bfastStart) {
            // From breakfast start time until lunch starts -> Breakfast
            activeMeal = 'Breakfast';  
        } else {
            // From midnight until breakfast starts -> Dinner (from the night before)
            activeMeal = 'Dinner';     
        }

        // Assemble the ultimate JSON payload for the Kiosk Team
        // Assemble the ultimate JSON payload for the Kiosk Team
        res.json({
            timestamp: istTime.toISOString(),
            active_meal: activeMeal, // Strictly controlled by rollover logic
            overall_daily_stats: {
                total_votes: statsResult[0].total_votes_today,
                average_rating: Number(statsResult[0].average_rating_today).toFixed(1)
            },
            today_menu: todayMenu,
            hall_of_fame: {
                Breakfast: hofBreakfast,
                Lunch: hofLunch,
                Dinner: hofDinner
            },
            today_menu: todayMenu,
            hall_of_fame: {
                Breakfast: hofBreakfast,
                Lunch: hofLunch,
                Dinner: hofDinner
            }
        });

    } catch (err) {
        console.error("❌ Kiosk API Error:", err);
        res.status(500).json({ error: "Failed to fetch live kiosk data" });
    }
});


// ==========================================
// STUDENT APP APIs
// ==========================================

app.post('/api/auth/login', (req, res) => {
    const { uid, password } = req.body;
    const sql = 'SELECT * FROM users WHERE uid = ? AND DATE_FORMAT(dob, "%d%m%Y") = ?';
    db.query(sql, [uid, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            res.json({ success: true, user: result[0] });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    });
});


// -----Student Gate pass routes-----
app.get('/api/gate/status/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT is_present FROM users WHERE uid = ?';
    db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ status: result[0].is_present ? 'in' : 'out' });
    });
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


// -----student grievances api's-----

app.post('/api/student/grievances', upload.single('evidence'), (req, res) => {
    const { uid, room_no, category, description } = req.body;
    const img_url = req.file ? `/uploads/${req.file.filename}` : null;
    const sql = "INSERT INTO grievances (uid, issue_location, category, description, img_url) VALUES (?, ?, ?, ?, ?)";
    
    db.query(sql, [uid, room_no, category, description, img_url], (err, result) => {
        if (err) {
            console.error("❌ Grievance Insert Error:", err.message); 
            return res.status(500).json(err);
        }
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

//----student mess review api's-----
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


//-----Overnight stay Routes-----
app.get('/api/warden/overnightlog', async (req, res) => {
    try {
        // Run all three queries in parallel
        const [outResult, totalResult, logsResult] = await Promise.all([
            db.promise().query("SELECT COUNT(*) as out_count FROM users WHERE role = 'student' AND is_present = 0"),
            db.promise().query("SELECT COUNT(*) as total_count FROM users WHERE role = 'student'"),
            db.promise().query(`
                SELECT gate_logs.*, users.full_name, users.uid, users.room_no, users.branch, users.batch, users.phone_no 
                FROM gate_logs 
                JOIN users ON gate_logs.uid = users.uid 
                ORDER BY exit_time DESC 
                LIMIT 200
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

app.get('/api/warden/out-list', (req, res) =>{
        const sql = "SELECT uid, full_name, phone_no, address, room_no, branch, batch FROM users WHERE is_present = 0 ORDER BY full_name ASC";    db.query(sql, (err, results) => {
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

//-----GRIEVANCE ROUTES-----

app.get('/api/warden/grievances', (req, res) => {
    // ✨ Added u.room_no to the SELECT statement
    const sql = `
      SELECT 
        g.*, 
        u.full_name, 
        u.room_no AS student_room, 
        u.branch, 
        u.batch, 
        u.phone_no
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



//----- STUDENT MANAGEMENT ROUTES-----

// 1. GET ALL STUDENTS (Now includes Batch & Branch) 
app.get('/api/warden/students', (req, res) => {
    const sql = `
        SELECT 
            u.uid, 
            u.full_name, 
            u.room_no, 
            u.phone_no, 
            u.address,
            u.dob, 
            u.batch,
            u.branch,
            (SELECT COUNT(*) FROM gate_logs WHERE uid = u.uid AND status = 'out') as checkout_count
        FROM users u 
        WHERE u.role = 'student'
        ORDER BY u.room_no ASC;
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching students:", err.message);
            return res.status(500).json(err);
        }
        res.json(results);
    });
});

//2. UPDATE SINGLE STUDENT 
app.put('/api/warden/students/:uid', (req, res) => {
    const { uid } = req.params;
    // ✨ Extract batch and branch from the incoming request body
    const { full_name, room_no, phone_no, address, dob, batch, branch } = req.body;     
    // ✨ Added batch=? and branch=? to the SET clause
    const sql = "UPDATE users SET full_name=?, room_no=?, phone_no=?, address=?, dob=?, batch=?, branch=? WHERE uid=?";    
    db.query(sql, [full_name, room_no, phone_no, address, dob, batch, branch, uid], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// 3. BULK UPLOAD STUDENTS (CSV) 
app.post('/api/warden/students/bulk-upload', uploadCsv.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const results = [];
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    bufferStream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let addedCount = 0;
            let skippedCount = 0; 

            try {
                // ✨ Start transaction directly on your db instance!
                await db.promise().beginTransaction();

                let rowNumber = 2; 

                for (let row of results) {
                    
                    if (!row.uid || row.uid.trim() === '') {
                        throw new Error(`CRITICAL: Row ${rowNumber} is completely missing a UID.`);
                    }

                    if (!row.full_name || !row.dob) {
                        throw new Error(`Row ${rowNumber} (${row.uid}) is missing a Name or DOB.`);
                    }

                    const uidRegex = /^[uU]\d{7}$/;
                    if (!uidRegex.test(row.uid)) {
                        throw new Error(`Row ${rowNumber}: Invalid UID format "${row.uid}". Must be U followed by 7 digits.`);
                    }

                    if (row.batch) {
                        const batchRegex = /^\d{4}-\d{2}$/;
                        if (!batchRegex.test(row.batch)) {
                            throw new Error(`Row ${rowNumber} (${row.uid}): Invalid batch format "${row.batch}". Expected YYYY-YY.`);
                        }
                    }

                    const dateRegex = /^(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})$/;
                    const dateMatch = row.dob.match(dateRegex);
                    if (!dateMatch) {
                        throw new Error(`Row ${rowNumber} (${row.uid}): Invalid DOB format "${row.dob}". Expected DD-MM-YYYY.`);
                    }

                    if (row.phone_no) {
                        const phoneRegex = /^\d{10}$/;
                        if (!phoneRegex.test(row.phone_no)) {
                            throw new Error(`Row ${rowNumber} (${row.uid}): Invalid phone number. Must be exactly 10 digits.`);
                        }
                    }

                    if (row.room_no && !HOSTEL_CONFIG.roomRegex.test(row.room_no)) {
                        throw new Error(`Row ${rowNumber} (${row.uid}): Invalid Room format "${row.room_no}".`);
                    }

                    const normalizedBranch = row.branch ? row.branch.trim().toUpperCase() : null;
                    if (normalizedBranch && !HOSTEL_CONFIG.allowedBranches.includes(normalizedBranch)) {
                        throw new Error(`Row ${rowNumber} (${row.uid}): Unknown Branch "${row.branch}". Check allowed branches.`);
                    }

                    const mysqlDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

                    // ✨ Query directly from db.promise()
                    const [existing] = await db.promise().query('SELECT id FROM users WHERE uid = ?', [row.uid]);

                    if (existing.length > 0) {
                        skippedCount++;
                    } else {
                        // ✨ Insert directly from db.promise()
                        await db.promise().query(
                            `INSERT INTO users 
                            (uid, dob, full_name, role, phone_no, address, room_no, batch, branch) 
                            VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?)`,
                            [
                                row.uid, 
                                mysqlDate, 
                                row.full_name, 
                                row.phone_no || null, 
                                row.address || null, 
                                row.room_no ? row.room_no.toUpperCase() : null,
                                row.batch || null,  
                                normalizedBranch 
                            ]
                        );
                        addedCount++;
                    }

                    rowNumber++;
                } 

                // ✨ Commit the changes directly to the db instance
                await db.promise().commit();
                
                let finalMessage = `Sync complete! Added ${addedCount} students.`;
                if (skippedCount > 0) finalMessage += ` Skipped ${skippedCount} existing UIDs.`;
                
                res.json({ success: true, message: finalMessage });

            } catch (err) {
                // ✨ Rollback directly on the db instance
                await db.promise().rollback();
                console.error("❌ Upload Aborted:", err.message);
                
                res.status(400).json({ 
                    error: err.message, 
                    details: "The entire upload was cancelled to protect database integrity. Please fix the CSV and try again." 
                });
            }
            // Note: No connection.release() needed since we aren't pulling from a pool!
        });
});

//  4. ADD SINGLE STUDENT MANUALLY 
app.post('/api/warden/students', async (req, res) => {
    const { uid, full_name, dob, phone_no, address, room_no, batch, branch } = req.body;

    // ✨ 1. STRICT ALL-FIELDS VALIDATION
    if (!uid || !full_name || !dob || !phone_no || !address || !room_no || !batch || !branch) {
        return res.status(400).json({ error: "All fields are strictly required to add a new student." });
    }

    // 2. Strict UID Bouncer
    if (!/^[uU]\d{7}$/.test(uid)) {
        return res.status(400).json({ error: "UID must be 'U' followed by exactly 7 digits." });
    }

    // 3. Strict Phone Bouncer
    if (!/^\d{10}$/.test(phone_no)) {
        return res.status(400).json({ error: "Phone number must be exactly 10 digits." });
    }

    // 4. Strict Batch Bouncer
    if (!/^\d{4}-\d{2}$/.test(batch)) {
        return res.status(400).json({ error: "Batch must be in YYYY-YY format (e.g., 2023-27)." });
    }

    // 5. Strict Date Bouncer 
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        return res.status(400).json({ error: "Date of Birth must be in YYYY-MM-DD format." });
    }

    // ... (Your existing UID, Phone, Batch, and Date bouncers) ...

    // ✨ NEW: STRICT ROOM BOUNCER
    if (!HOSTEL_CONFIG.roomRegex.test(room_no)) {
        return res.status(400).json({ error: "Invalid Room format. Must be a Letter followed by a dash and number (e.g., A-101)." });
    }

    // ✨ NEW: STRICT BRANCH BOUNCER
    // We trim and uppercase it so "computer science" safely matches "COMPUTER SCIENCE"
    const normalizedBranch = branch.trim().toUpperCase();
    if (!HOSTEL_CONFIG.allowedBranches.includes(normalizedBranch)) {
        return res.status(400).json({ error: `Invalid Branch. Must be one of: ${HOSTEL_CONFIG.allowedBranches.join(', ')}` });
    }

    try {
        const [existing] = await db.promise().query('SELECT id FROM users WHERE uid = ?', [uid]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "A student with this UID already exists." });
        }

        // We can safely remove the '|| null' fallbacks now since we guarantee every variable has data
        await db.promise().query(
            `INSERT INTO users 
            (uid, dob, full_name, role, phone_no, address, room_no, batch, branch) 
            VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?)`,
            [uid, dob, full_name, phone_no, address, room_no, batch, branch]
        );

        res.json({ success: true, message: "Student added successfully!" });
    } catch (err) {
        console.error("Error adding student:", err);
        res.status(500).json({ error: "Database error while adding student." });
    }
});

// 5. DELETE STUDENT 
app.delete('/api/warden/students/:uid', async (req, res) => {
    const { uid } = req.params;
    try {
        // We ensure role = 'student' so a Warden can't accidentally delete another Warden
        const [result] = await db.promise().query('DELETE FROM users WHERE uid = ? AND role = "student"', [uid]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Student not found." });
        }
        
        res.json({ success: true, message: "Student removed from registry." });
    } catch (err) {
        console.error("Error deleting student:", err);
        res.status(500).json({ error: "Database error. Student may have tied records (like gate logs)." });
    }
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

//=============================
//----- Menu Routes-----
//-------------------------

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

    // 🛡️ 1. THE DIET BOUNCER
    if (!['Veg', 'Non-Veg', 'Common'].includes(diet_type)) {
        return res.status(400).json({ error: "Diet type must be exactly 'Veg', 'Non-Veg', or 'Common'." });
    }

    // 🛡️ 2. THE EFFORT SCORE BOUNCER
    const effort = parseInt(effort_score);
    if (effort < 1 || effort > 10) {
        return res.status(400).json({ error: "Effort score must be a number between 1 and 10." });
    }
    
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

// 3. DELETE: Remove a dish from the Menu Catalog
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

// 4. PUT: Update an existing dish in the Menu Catalog
app.put('/api/admin/menu-catalog/:id', (req, res) => {
    const dishId = req.params.id;
    const { dish_name, diet_type, cost, effort_score } = req.body;

    // 🛡️ THE BOUNCERS
    if (!['Veg', 'Non-Veg', 'Common'].includes(diet_type)) {
        return res.status(400).json({ error: "Diet type must be exactly 'Veg', 'Non-Veg', or 'Common'." });
    }
    const effort = parseInt(effort_score);
    if (effort < 1 || effort > 10) {
        return res.status(400).json({ error: "Effort score must be between 1 and 10." });
    }

    // Step 1: Check for duplicate names (EXCLUDING the current dish we are editing!)
    const checkSql = "SELECT id FROM menu_catalog WHERE LOWER(dish_name) = LOWER(?) AND id != ?";
    
    db.query(checkSql, [dish_name, dishId], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });

        if (results.length > 0) {
            return res.status(409).json({ error: `Another dish named "${dish_name}" already exists!` });
        }

        // Step 2: Update the dish
        const updateSql = "UPDATE menu_catalog SET dish_name = ?, diet_type = ?, cost = ?, effort_score = ? WHERE id = ?";
        db.query(updateSql, [dish_name, diet_type, cost, effort, dishId], (updateErr) => {
            if (updateErr) {
                console.error("Error updating dish:", updateErr);
                return res.status(500).json({ error: "Failed to update dish" });
            }
            res.json({ success: true, message: "Dish updated successfully!" });
        });
    });
});

// 5. GET: Fetch the planned menu for a specific date range (e.g., a full week)
app.get('/api/admin/weekly-menu', (req, res) => {
    const startDate = req.query.start;
    const endDate = req.query.end;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "Please provide both start and end dates." });
    }

    const sql = `
        SELECT 
            d.id as schedule_id, 
            d.serve_date, 
            d.meal_type, 
            d.dish_id,
            d.status, 
            m.dish_name, 
            m.diet_type,
            m.cost,
            m.effort_score 
        FROM daily_menu d
        JOIN menu_catalog m ON d.dish_id = m.id
        WHERE d.serve_date BETWEEN ? AND ?
        ORDER BY 
            d.serve_date ASC, 
            FIELD(d.meal_type, 'Breakfast', 'Lunch', 'Dinner')
    `;

    db.query(sql, [startDate, endDate], (err, results) => {
        if (err) {
            console.error("❌ Error fetching weekly menu:", err.message);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// 6. DELETE: Remove a scheduled dish from the daily menu
app.delete('/api/admin/daily-menu/:id', (req, res) => {
    const scheduleId = req.params.id; 
    const sql = "DELETE FROM daily_menu WHERE id = ?";
    
    db.query(sql, [scheduleId], (err, result) => {
        if (err) {
            console.error("Error deleting scheduled dish:", err);
            return res.status(500).json({ error: "Failed to delete dish" });
        }
        res.json({ success: true, message: "Dish removed from schedule!" });
    });
});

// 7. GET: Fetch all meal timings
app.get('/api/admin/meal-timings', (req, res) => {
    const sql = "SELECT * FROM meal_timings";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching timings:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
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

// 8. PUT: Update a specific meal timing
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

// 9. POST: Auto-generate menu using Gemini + Python GA
app.post('/api/admin/ga-generate-menu', async (req, res) => {
    const { start_date, end_date, custom_prompt } = req.body;

    if (!start_date) return res.status(400).json({ error: "Start date is required." });

    try {
        // 1. Fetch Catalog
        const [catalog] = await db.promise().query("SELECT id, dish_name, diet_type, cost, effort_score, popularity_score FROM menu_catalog");
        
        // 2. Python Runs First (Mathematical Draft)
        const pythonRes = await axios.post('http://localhost:5000/generate-menu', { catalog, start_date });
        const pythonDraft = pythonRes.data.proposed_menu;

        // 3. Gemini Runs Second (Audit & Apply Your Rules)
        const systemPrompt = `You are a Kerala Hostel Mess Manager. 
        Algorithm Draft: ${JSON.stringify(pythonDraft)}
        Full Catalog: ${JSON.stringify(catalog)}

        Audit and finalize the draft menu. You MUST fix any culinary errors (e.g., Rice/Chicken for Breakfast). 
        If you replace a dish, you MUST update both the 'dish_name' and 'dish_id' from the Catalog.

        STRICT RULES:
        1. Dates between ${start_date} and ${end_date} must have Breakfast, Lunch, and Dinner.
        2. Every meal MUST have one Veg/Common option AND one Non-Veg option(unless Friday/Custom says otherwise).
        3. Don't include another Veg/Non-Veg option along with a Common option on any slot. 
        4. Prioritize rice items for Lunch if present.
        5. Balance cost and effort score.
        6. No exact repeat meals two days in a row.
        7. Prioritize high popularity_score items.
        8. Warden Instruction: "${custom_prompt || 'Select only one Common Meal for every BreakFast Slot'}"

        Return ONLY the finalized array of objects as raw JSON. No markdown.`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(systemPrompt);
        
        // --- Bulletproof Extraction ---
        let aiText = result.response.text();
        const start = aiText.indexOf('['), end = aiText.lastIndexOf(']');
        if (start !== -1 && end !== -1) aiText = aiText.substring(start, end + 1);
        aiText = aiText.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
        
        const finalMenu = JSON.parse(aiText);
        res.json({ success: true, proposed_menu: finalMenu });

    } catch (err) {
        console.error("Hybrid AI Pipeline Error:", err);
        res.status(500).json({ error: "AI Pipeline failed." });
    }
});

// 10. 📁 BULK UPLOAD MENU CATALOG (CSV)
app.post('/api/admin/menu-catalog/bulk-upload', uploadCsv.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const results = [];
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    bufferStream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let addedCount = 0;
            let skippedCount = 0;
            let invalidCount = 0; 

            try {
                for (let row of results) {
                    
                    // ✨ 1. THE DIET BOUNCER
                    const allowedDiets = ['Veg', 'Non-Veg', 'Common'];
                    const formattedDiet = allowedDiets.find(d => d.toLowerCase() === (row.diet_type || '').trim().toLowerCase());
                    if (!formattedDiet) {
                        console.log(`Rejected Dish: "${row.dish_name}" has invalid diet: ${row.diet_type}`);
                        invalidCount++;
                        continue;
                    }

                    // ✨ 2. THE EFFORT SCORE BOUNCER
                    const effort = parseInt(row.effort_score) || 5;
                    if (effort < 1 || effort > 10) {
                        console.log(`Rejected Dish: "${row.dish_name}" has invalid effort score: ${effort}`);
                        invalidCount++;
                        continue;
                    }

                    const [existing] = await db.promise().query(
                        'SELECT id FROM menu_catalog WHERE dish_name = ?', 
                        [row.dish_name]
                    );

                    if (existing.length > 0) {
                        skippedCount++;
                    } else {
                        await db.promise().query(
                            'INSERT INTO menu_catalog (dish_name, diet_type, effort_score, cost) VALUES (?, ?, ?, ?)',
                            [row.dish_name, formattedDiet, effort, row.cost || 0] 
                        );
                        addedCount++;
                    }
                }

                res.json({ 
                    success: true, 
                    message: `Upload complete! Added ${addedCount}. Skipped ${skippedCount} duplicates. Rejected ${invalidCount} invalid rows.`,
                });

            } catch (dbErr) {
                console.error("Database error during CSV import:", dbErr);
                res.status(500).json({ error: "Database error during import." });
            }
        });
});

// 11. PUT: Sync and Approve the entire week's menu at once
app.put('/api/admin/weekly-menu/sync', async (req, res) => {
    const { start_date, end_date, menu_items } = req.body;
    
    try {
        // 1. Clear out the existing schedule for this exact date range
        await db.promise().query("DELETE FROM daily_menu WHERE serve_date BETWEEN ? AND ?", [start_date, end_date]);

        if (!menu_items || menu_items.length === 0) {
            return res.json({ success: true, message: "Menu cleared and saved." });
        }

        const resolvedSchedule = [];

        // 2. Loop through the AI's draft to resolve IDs
        for (let item of menu_items) {
            let currentDishId = item.dish_id;

            // ✨ THE MAGIC: If the AI invented this dish, it won't have an ID yet!
            if (item.is_new_creation) {
                const insertSql = "INSERT INTO menu_catalog (dish_name, diet_type, cost, effort_score) VALUES (?, ?, ?, ?)";
                const [result] = await db.promise().query(insertSql, [
                    item.dish_name, 
                    item.diet_type, 
                    item.cost || 0, 
                    item.effort_score || 5
                ]);
                // Grab the freshly minted ID from the database!
                currentDishId = result.insertId; 
            }

            // Push the resolved item to our final scheduling array
            resolvedSchedule.push([
                item.serve_date, 
                item.meal_type, 
                currentDishId, 
                'Approved' // Everything saved through this route is officially approved
            ]);
        }

        // 3. Bulk insert the finalized schedule into the daily_menu table
        const scheduleSql = "INSERT INTO daily_menu (serve_date, meal_type, dish_id, status) VALUES ?";
        await db.promise().query(scheduleSql, [resolvedSchedule]);

        res.json({ success: true, message: "Weekly menu saved! Any new AI recipes were added to the catalog." });
        
    } catch (err) {
        console.error("Error syncing weekly menu:", err);
        res.status(500).json({ error: "Failed to save weekly menu" });
    }
});


// -------WARDEN MESS REVIEWS API-------
// GET: Fetch all student mess reviews for the Analytics Dashboard
app.get('/api/admin/mess-reviews', (req, res) => {
    const sql = `
        SELECT 
            r.id, r.serve_date, r.meal_type, r.diet_type, r.rating, r.dish_issues, r.comment, r.created_at,
            (
                SELECT GROUP_CONCAT(mc.dish_name ORDER BY mc.diet_type ASC SEPARATOR ' + ')
                FROM daily_menu dm
                JOIN menu_catalog mc ON dm.dish_id = mc.id
                WHERE DATE(dm.serve_date) = DATE(r.serve_date) 
                  AND dm.meal_type = r.meal_type
                  AND dm.status = 'Approved' 
                  AND (mc.diet_type = r.diet_type OR mc.diet_type = 'Common')
            ) AS served_dishes
        FROM mess_reviews r 
        ORDER BY r.created_at DESC, r.serve_date DESC
    `;
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching reviews:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});
//  GENERATE AI INSIGHTS FROM REVIEWS
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









//  TEMPORARY ROUTE TO FORCE BAYESIAN CALCULATION 
app.get('/api/admin/force-popularity-sync', async (req, res) => {
    console.log("🧮 Running Math Engine: Bayesian Average + Flag Penalties...");
    try {
        // 1. Get base stats AND the dish name so we can match it to the JSON
        const fetchReviewsSql = `
            SELECT 
                mc.id AS dish_id,
                mc.dish_name,
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


        // Run both fetches
        const [dishes] = await db.promise().query(fetchReviewsSql);
        const [issues] = await db.promise().query(fetchIssuesSql);
        // 2. Fetch all raw JSON issues across the entire database
        const fetchIssuesSql = `SELECT dish_issues FROM mess_reviews WHERE dish_issues IS NOT NULL AND dish_issues != '{}'`;


        if (dishes.length === 0) {
            return res.json({ success: true, message: "No dishes to update." });
        }

        // --- THE CONSTANTS ---
        // . Build a "Flag Dictionary" 
        // Example output: { "Idli": 12, "Chicken Curry": 4 }
        const flagDictionary = {};
        issues.forEach(row => {
            try {
                const parsed = typeof row.dish_issues === 'string' ? JSON.parse(row.dish_issues) : row.dish_issues;
                Object.entries(parsed).forEach(([dishName, tags]) => {
                    if (!flagDictionary[dishName]) flagDictionary[dishName] = 0;
                    // Add the number of tags (e.g., "Cold" and "Bland" = 2 penalties)
                    flagDictionary[dishName] += tags.length; 
                });
            } catch (e) { /* Ignore malformed JSON */ }
        });

        // Helper: Split combo dish names exactly like your frontend does!
        const splitDishName = (name) => {
            if (!name) return [];
            return name.split(/ \+ | & | and |, /i).map(s => s.trim()).filter(Boolean);
        };

        // --- THE CONSTANTS ---
        const C = 10;   // Dummy votes
        const m = 3.5;  // Baseline score
        const PENALTY_PER_FLAG = 0.15; // How much a single tag drops the score
        let completedUpdates = 0; 

        // 4. Calculate and Update each dish
        dishes.forEach(dish => {
            const realSum = dish.real_votes * dish.real_avg;
            const dummySum = C * m;
            const totalVotes = dish.real_votes + C;
            
            // Step A: Base Bayesian Score
            let score = (realSum + dummySum) / totalVotes;

            // Step B: Calculate Total Flags for this specific dish (handling combos)
            const subItems = splitDishName(dish.dish_name);
            let totalFlagsForDish = 0;
            subItems.forEach(subItem => {
                if (flagDictionary[subItem]) {
                    totalFlagsForDish += flagDictionary[subItem];
                }
            });

            // Step C: Apply the Penalty
            const totalPenalty = totalFlagsForDish * PENALTY_PER_FLAG;
            score = score - totalPenalty;

            // Step D: Clamp the score so it stays between 1.0 and 5.0
            if (score < 1.0) score = 1.0;
            if (score > 5.0) score = 5.0;

            const finalScore = score.toFixed(2);

            // 5. Save it back to the catalog
            // 5. Save it back to the catalog
            const updateSql = `UPDATE menu_catalog SET popularity_score = ? WHERE id = ?`;
            db.query(updateSql, [finalScore, dish.dish_id], (updateErr) => {
                if (updateErr) console.error(`❌ Failed to update dish ${dish.dish_id}`);
                
                completedUpdates++;
                if (completedUpdates === dishes.length) {
                    console.log("✅ All dishes updated with Penalty-Adjusted Bayesian scores!");
                    console.log("✅ All dishes updated with Penalty-Adjusted Bayesian scores!");
                    res.json({ 
                        success: true, 
                        message: `Math Complete! Updated ${dishes.length} dishes with Flag Penalties applied. Check the Warden Dashboard!` 
                    });
                }
            });
        });

    } 
    catch (err) {
        console.error("❌ Math Engine Error:", err);
        res.status(500).json({ error: "Failed to calculate penalties", mysql_error: err.message });
    }
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