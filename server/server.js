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

// Test Route
app.get('/', (req, res) => {
    res.send('HostelSync API is Live');
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

app.listen(3001, () => {
    console.log('🚀 Server running on port 3001');
});