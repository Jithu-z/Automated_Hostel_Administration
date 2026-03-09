# WhatsApp Bot Server Documentation

## 📚 Overview
This server.js file is a **WhatsApp Bot** that manages a digital notice board system for a hostel. It allows users to send images via WhatsApp that get displayed on a kiosk/digital display system.

## 🏗️ Architecture

### Main Components
1. **Express Server** - Web server that provides API endpoints
2. **WhatsApp Client** - Connects to WhatsApp Web to receive messages
3. **File Management** - Handles image storage and optimization
4. **Notice System** - Manages current notice display with expiration

---

## 📋 Detailed Breakdown

### 1. IMPORTS & SETUP (Lines 1-13)

```javascript
const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
```

**What each library does:**
- **express**: Web server framework
- **whatsapp-web.js**: Library to connect to WhatsApp Web
- **multer**: Handles file uploads
- **fs-extra**: Advanced file system operations
- **path**: Handles file paths
- **sharp**: Image processing library
- **uuid**: Generates unique IDs for files
- **qrcode**: Generates QR codes

### 2. SERVER CONFIGURATION (Lines 14-30)

```javascript
const app = express();
const PORT = 3001;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  // ... more CORS headers
});

// Static files
app.use(express.static('public'));
```

**Purpose:**
- Sets up an Express server on port 3001
- **CORS** allows other websites to access this API
- **Static files** serves images and QR codes from the `public` folder

### 3. FILE STORAGE SETUP (Lines 32-43)

```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, NOTICE_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}-${Date.now()}.jpg`;
    cb(null, uniqueName);
  }
});
```

**What this does:**
- Configures where uploaded files are saved
- Generates unique filenames using UUID + timestamp
- All files are saved as `.jpg` format

### 4. WHATSAPP CLIENT SETUP (Lines 45-69)

```javascript
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'hostel-bot-session'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      // ... more Chrome flags
    ]
  }
});
```

**Important Settings:**
- **LocalAuth**: Saves login session so you don't need to scan QR every time
- **headless: true**: Runs Chrome in background without opening browser window
- **Puppeteer args**: Chrome flags for server environment

### 5. CURRENT NOTICE STATE (Lines 71-77)

```javascript
let currentNotice = {
  imagePath: null,    // Path to the current notice image
  expiresAt: null,    // When the notice expires
  caption: '',        // The message caption
  duration: null      // How long it should display
};
```

**This is the "brain" of the system** - stores the currently active notice.

---

## 🔧 Core Functions Explained

### 1. parseTimeFromCaption() (Lines 80-108)

**Purpose:** Extracts time duration from message captions

**How it works:**
```javascript
// Example captions it understands:
"#2h" → 2 hours
"#1d" → 1 day  
"#30m" → 30 minutes
"#60s" → 60 seconds
```

**Process:**
1. Uses regex patterns to find time codes
2. Converts to milliseconds
3. Returns object with duration, unit, and value

### 2. processImageMessage() (Lines 111-153)

**Purpose:** Handles incoming image messages

**Step-by-step:**
1. **Download** the image from WhatsApp
2. **Save** it to the server with unique filename
3. **Optimize** the image (resize, compress)
4. **Parse** the time from caption
5. **Clean up** old notice
6. **Update** current notice state
7. **Send** confirmation reply

### 3. processImage() (Lines 172-192)

**Purpose:** Optimizes images for kiosk display

**What it does:**
- Resizes images to max 1920x1080 pixels
- Compresses to 85% quality (smaller file size)
- Saves as new optimized file
- Deletes original large file

### 4. cleanExpiredNotices() (Lines 156-169)

**Purpose:** Automatically removes expired notices

**How it works:**
1. Checks if current notice has expired
2. Deletes the image file if expired
3. Resets the notice state to null

---

## 📡 WhatsApp Event Handlers

### 1. QR Code Event (Lines 195-222)

```javascript
client.on('qr', async (qr) => {
  // Generates QR code for WhatsApp login
  // Saves it as /public/qr.png
  // Available at http://localhost:3001/qr.png
});
```

**When this happens:**
- First time setup or when session expires
- User scans QR with WhatsApp mobile app
- QR expires after 20 seconds

### 2. Message Events (Lines 255-339)

**Message Flow:**
1. **message_create** - Messages sent from linked devices
2. **message_sent** - Alternative event for sent messages  
3. **message** - Incoming messages (ignored in this bot)

**Security Filter:**
```javascript
// Only processes messages that are:
if (!message.fromMe) return;           // From the bot itself
if (message.to !== WHITELISTED_RECIPIENT) return; // To specific group
```

### 3. Command Processing (Lines 288-315)

**Available Commands:**
- **/status** - Shows current notice information
- **/clear** - Removes current notice
- **/help** - Shows help message

---

## 🌐 API Endpoints

### 1. GET /api/kiosk/current-notice

**Purpose:** Returns current notice info for kiosk display

**Response:**
```json
{
  "success": true,
  "noticeUrl": "/notices/filename.jpg",
  "expiresAt": 1640995200000,
  "caption": "Meeting at 5pm",
  "duration": {"value": 2, "unit": "hours"}
}
```

### 2. GET /api/kiosk/notice-image

**Purpose:** Serves the actual notice image file

### 3. GET /api/health

**Purpose:** Health check endpoint

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2023-12-31T23:59:59.999Z",
  "whatsappReady": true
}
```

---

## 🔄 How It All Works Together

### Typical Workflow:

1. **Server Starts**
   - Express server starts on port 3001
   - WhatsApp client initializes
   - QR code generated for first-time login

2. **User Sends Image**
   - User sends image with caption like "#2h" to WhatsApp
   - Bot receives message via `message_create` event
   - Image gets downloaded and processed
   - Notice gets stored in `currentNotice` variable

3. **Kiosk Displays Notice**
   - Kiosk calls `/api/kiosk/current-notice` every few seconds
   - Gets notice URL and displays the image
   - Notice automatically expires after specified time

4. **Cleanup**
   - `cleanExpiredNotices()` runs every minute
   - Removes expired notices automatically

---

## 📁 File Structure

```
whatsapp-bot/
├── server.js              # Main server file
├── package.json           # Dependencies
├── public/                # Static files
│   ├── notices/           # Stored notice images
│   ├── qrcodes/           # QR code images
│   └── qr.png            # Current QR code
├── .wwebjs_cache/        # WhatsApp session cache
└── .wwebjs_auth/         # WhatsApp authentication
```

---

## 🛠️ Configuration Options

### Port Settings
```javascript
const PORT = 3001; // Change if needed
```

### Whitelist Recipient
```javascript
const WHITELISTED_RECIPIENT = '146136966922311@lid';
// Only processes messages sent to this group/user
```

### Image Optimization
```javascript
await sharp(imagePath)
  .resize(1920, 1080, { 
    fit: 'inside',
    withoutEnlargement: true 
  })
  .jpeg({ quality: 85 })
```

---

## 🚨 Important Notes for Students

### Security Considerations
1. **Whitelist System**: Only processes messages from specific recipients
2. **Session Management**: Uses LocalAuth to maintain login session
3. **File Validation**: Only processes image files

### Error Handling
- Try-catch blocks around file operations
- Graceful handling of WhatsApp disconnections
- Automatic cleanup of expired notices

### Performance Features
- **Image Optimization**: Reduces file sizes for faster loading
- **Automatic Cleanup**: Prevents disk space issues
- **Efficient Storage**: Uses UUID for unique filenames

### Debugging Tips
1. Check console logs for detailed information
2. Use `/status` command to see current state
3. Monitor `/api/health` endpoint for server status

---

## 📝 Common Issues & Solutions

### QR Code Not Working
- Delete `.wwebjs_auth` folder and restart
- Check internet connection
- Ensure WhatsApp Web is not blocked

### Images Not Displaying
- Check if images are in `/public/notices/` folder
- Verify file permissions
- Check API response from `/api/kiosk/current-notice`

### Bot Not Responding
- Check if WhatsApp client is ready
- Verify recipient ID is correct
- Check console for error messages

---

## 🎓 Learning Points for Students

1. **Event-Driven Programming**: Understanding how WhatsApp events work
2. **File Management**: Handling uploads, storage, and cleanup
3. **API Design**: Creating RESTful endpoints
4. **Image Processing**: Using Sharp for optimization
5. **Session Management**: Maintaining WhatsApp authentication
6. **Error Handling**: Graceful failure recovery
7. **Security**: Implementing whitelist and validation

This project demonstrates real-world concepts like:
- Microservices architecture
- Background processing
- Resource management
- API integration
- File system operations

---

*Last Updated: December 2023*
*For educational purposes - Hostel Notice Board System*
