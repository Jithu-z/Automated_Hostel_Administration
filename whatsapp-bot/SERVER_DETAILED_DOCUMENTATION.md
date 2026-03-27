# WhatsApp Bot Server.js - Line by Line Documentation

## Table of Contents
1. [Imports and Dependencies](#imports-and-dependencies)
2. [Server Configuration](#server-configuration)
3. [WhatsApp Client Setup](#whatsapp-client-setup)
4. [State Management](#state-management)
5. [Core Functions](#core-functions)
6. [WhatsApp Event Handlers](#whatsapp-event-handlers)
7. [API Endpoints](#api-endpoints)
8. [Server Startup](#server-startup)

---

## Imports and Dependencies

### Lines 1-12: Import Statements
```javascript
const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
```

**Explanation:**
- **express**: Web framework for creating API endpoints and serving static files
- **whatsapp-web.js**: Core WhatsApp integration library
  - `Client`: Main WhatsApp client class
  - `LocalAuth`: Authentication strategy to save session locally
  - `MessageMedia`: Handle media files (images, documents)
- **multer**: Middleware for handling file uploads (multipart/form-data)
- **cors**: Enable Cross-Origin Resource Sharing for frontend-backend communication
- **fs-extra**: Enhanced file system operations with promises
- **path**: Node.js path utilities for cross-platform file paths
- **sharp**: Image processing library for resizing and optimization
- **uuid**: Generate unique identifiers for notices
- **qrcode**: Generate QR codes for WhatsApp authentication

**Why these choices:**
- Express is standard for Node.js APIs
- whatsapp-web.js is the most reliable WhatsApp automation library
- Sharp provides fast, efficient image processing
- UUID ensures unique notice tracking

### Lines 14-23: Express App Setup
```javascript
const app = express();
const PORT = 3001;

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Static files
app.use(express.static('public'));
```

**Line 14:** Initialize Express application
**Line 15:** Define server port (3001 for WhatsApp bot API)

**Lines 17-22:** CORS Middleware Configuration
- **Purpose**: Allow React frontend (different port) to access API
- **Access-Control-Allow-Origin**: '*' permits any origin (development)
- **Methods**: Defines allowed HTTP methods
- **Headers**: Specifies which headers are permitted
- **Why**: Prevents browser security blocks during development

**Line 23:** Static File Serving
- **Purpose**: Serve files from 'public' directory
- **Examples**: QR codes, notice images, HTML pages
- **URL Mapping**: `/qr.png` → `public/qr.png`

---

## WhatsApp Client Setup

### Lines 25-69: WhatsApp Client Configuration
```javascript
// WhatsApp Client Setup
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'hostel-bot-session'
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  },
  qrMaxRetries: 3,
  takeoverOnConflict: false,
  takeoverTimeoutMs: 10000
});
```

**Lines 26-28:** Authentication Strategy
- **LocalAuth**: Saves WhatsApp session locally for auto-reconnect
- **clientId**: 'hostel-bot-session' identifies this specific bot instance
- **Why**: Avoids re-scanning QR code on every restart

**Lines 29-45:** Puppeteer Configuration (Chrome Browser Settings)
- **headless: true**: Run Chrome without visible GUI (server environment)
- **--no-sandbox**: Required for running in Docker/servers
- **--disable-setuid-sandbox**: Additional sandbox security bypass
- **--disable-dev-shm-usage**: Prevents shared memory issues in containers
- **--disable-accelerated-2d-canvas**: Reduces resource usage
- **--no-first-run**: Skip Chrome first-time setup
- **--no-zygote**: Disable Chrome process spawning
- **--disable-gpu**: Disable GPU acceleration (server environment)
- **--disable-extensions**: Prevent extension conflicts
- **--disable-background-***: Prevent Chrome from throttling background processes

**Why these flags:**
- **Server compatibility**: Most flags are required for headless server environments
- **Resource optimization**: Reduces CPU/memory usage
- **Stability**: Prevents crashes in containerized environments

**Lines 66-68:** Connection Management
- **qrMaxRetries: 3**: Limit QR generation attempts (prevents infinite loops)
- **takeoverOnConflict: false**: Don't steal existing WhatsApp sessions
- **takeoverTimeoutMs: 10000**: Wait 10 seconds before giving up takeover

---

## State Management

### Lines 71-75: Multi-Notice State System
```javascript
// Current notices state - changed to handle multiple notices
let currentNotices = []; // Array to store multiple notices

// Maximum number of active notices
const MAX_NOTICES = 5;
```

**Line 72:** `currentNotices = []`
- **Purpose**: Array to store all active notice objects
- **Why array**: Support multiple simultaneous notices (vs. single object)
- **Structure**: Each element is a notice object with metadata

**Line 75:** `MAX_NOTICES = 5`
- **Purpose**: Limit system resources and prevent abuse
- **Why 5**: Reasonable limit for kiosk display without overwhelming users
- **Configurable**: Easy to adjust based on requirements

---

## Core Functions

### Lines 77-128: Caption Time Parser
```javascript
// Parse time from caption
function parseTimeFromCaption(caption) {
  console.log(`Parsing time from caption: "${caption}"`);
  
  // Check for #alert keyword first
  if (caption.includes('#alert')) {
    console.log('Found #alert keyword - setting permanent notice mode');
    return {
      duration: null, // No expiry
      unit: 'permanent',
      value: null,
      isAlert: true,
      valid: true
    };
  }
  
  const patterns = [
    { regex: /#(\d+)d/, multiplier: 24 * 60 * 60 * 1000, unit: 'days' },
    { regex: /#(\d+)h/, multiplier: 60 * 60 * 1000, unit: 'hours' },
    { regex: /#(\d+)hr/, multiplier: 60 * 60 * 1000, unit: 'hours' },
    { regex: /#(\d+)m/, multiplier: 60 * 1000, unit: 'minutes' },
    { regex: /#(\d+)min/, multiplier: 60 * 1000, unit: 'minutes' },
    { regex: /#(\d+)s/, multiplier: 1000, unit: 'seconds' },
    { regex: /#(\d+)sec/, multiplier: 1000, unit: 'seconds' }
  ];

  for (const pattern of patterns) {
    const match = caption.match(pattern.regex);
    console.log(`Testing pattern ${pattern.regex}: match = ${JSON.stringify(match)}`);
    if (match && match[1]) {
      const value = parseInt(match[1]);
      console.log(`Found match: ${value} ${pattern.unit}`);
      return {
        duration: value * pattern.multiplier,
        unit: pattern.unit,
        value: value,
        isAlert: false,
        valid: true
      };
    }
  }
  console.log(`No time pattern found, using default`);
  return { 
    duration: 24 * 60 * 60 * 1000, 
    unit: 'days', 
    value: 1,
    isAlert: false,
    valid: false // Mark as invalid since no time pattern was found
  };
}
```

**Lines 79-94:** Alert Detection
- **#alert keyword check**: Special case for permanent notices
- **Early return**: Immediately process alerts (no time parsing needed)
- **Return object**: Contains null duration, alert flag, valid=true
- **Why prioritized**: Alerts are critical and shouldn't expire

**Lines 96-104:** Time Pattern Definitions
- **Regex patterns**: Match different time formats (#1d, #2h, #30m, #20s)
- **Multiple formats**: Support both short (h) and long (hr) variations
- **Multipliers**: Convert human time to milliseconds for calculations
- **Why array**: Easy to extend with new time formats

**Lines 106-120:** Pattern Matching Loop
- **Sequential testing**: Try each pattern until match found
- **Regex match**: Extract numeric value from caption
- **Console logging**: Debug information for troubleshooting
- **Return object**: Contains duration, unit, value, validity

**Lines 122-128:** Default/Fallback
- **Default duration**: 24 hours if no pattern found
- **valid: false**: Indicates caption format issue
- **Why**: Prevents completely broken notices

**Why this design:**
- **Flexible**: Supports multiple time formats
- **Robust**: Handles edge cases and provides defaults
- **Debuggable**: Extensive logging for troubleshooting
- **Extensible**: Easy to add new time patterns

### Lines 130-210: Image Message Processor
```javascript
// Process image message function
async function processImageMessage(message, media) {
  try {
    console.log('Processing image message...');
    
    // Check if caption is empty or only whitespace
    if (!message.body || message.body.trim() === '') {
      console.log('Image sent without caption');
      const warningMessage = `⚠️ Caption Required\n\nYour image was received but needs a caption with duration.\n\nRequired Caption Structure:\n• Add duration tag: #1d, #2h, #30m, #20s\n• For permanent alerts: #alert\n\nPlease resend the image with proper caption.`;
      
      message.reply(warningMessage);
      console.log('Sent warning message for missing caption');
      return; // Stop processing if no caption
    }
    
    // Parse time from caption and validate format
    const timeInfo = parseTimeFromCaption(message.body);
    
    // Check if caption format is valid
    if (!timeInfo.valid) {
      console.log('Invalid caption format detected');
      const warningMessage = `⚠️ Invalid Caption Format\n\nYour caption doesn't follow the required format.\n\nRequired Caption Structure:\n• Add duration tag: #1d, #2h, #30m, #20s\n• For permanent alerts: #alert\n\nPlease resend the image with proper caption format.`;
      
      message.reply(warningMessage);
      console.log('Sent warning message for invalid caption format');
      return; // Stop processing if invalid format
    }
    
    // Check if we've reached the maximum number of notices
    if (currentNotices.length >= MAX_NOTICES) {
      console.log(`Maximum notices limit reached (${MAX_NOTICES})`);
      const warningMessage = `⚠️ Maximum Notices Reached\n\nYou can only have ${MAX_NOTICES} active notices at a time.\n\nCurrent notices: ${currentNotices.length}\n\nTo add a new notice:\n1. Wait for some notices to expire, OR\n2. Use /clear to remove all notices, OR\n3. Use /status to see current notices`;
      
      message.reply(warningMessage);
      console.log('Sent warning message for maximum notices limit');
      return;
    }
    
    // Save image
    const buffer = Buffer.from(media.data, 'base64');
    const filename = `${uuidv4()}-${Date.now()}.jpg`;
    const imagePath = path.join(NOTICE_DIR, filename);
    
    fs.writeFileSync(imagePath, buffer);
    console.log(`Image saved: ${filename}`);
    
    // Process and optimize image
    const processedPath = await processImage(message, imagePath);
    
    // Calculate expiry time (null for alerts)
    const expiresAt = timeInfo.isAlert ? null : Date.now() + timeInfo.duration;
    
    // Create new notice object
    const newNotice = {
      id: uuidv4(),
      imagePath: processedPath,
      expiresAt: expiresAt,
      caption: message.body,
      duration: timeInfo,
      isAlert: timeInfo.isAlert,
      createdAt: Date.now(),
      createdBy: message.from
    };
    
    // Add to notices array
    currentNotices.push(newNotice);
    
    // Send confirmation
    let reply;
    if (timeInfo.isAlert) {
      reply = `🚨 ALERT NOTICE SET!\n\nThis notice will remain permanently until replaced.\nNo expiry time set.\n\nNotice ID: ${newNotice.id.substring(0, 8)}\nTotal active notices: ${currentNotices.length}/${MAX_NOTICES}\n\nYour alert is now displayed on the kiosk.`;
    } else {
      reply = `Notice added successfully!\n\nDuration: ${timeInfo.value} ${timeInfo.unit}\nExpires: ${new Date(expiresAt).toLocaleString()}\n\nNotice ID: ${newNotice.id.substring(0, 8)}\nTotal active notices: ${currentNotices.length}/${MAX_NOTICES}\n\nYour notice is now displayed on the kiosk.`;
    }
    message.reply(reply);
    
    console.log(`Notice added: ${newNotice.id.substring(0, 8)}, ${timeInfo.isAlert ? 'ALERT MODE - No expiry' : `expires in ${timeInfo.value} ${timeInfo.unit}`}`);
    
  } catch (error) {
    console.error('Error processing image message:', error);
    message.reply('Sorry, there was an error processing your image. Please try again.');
  }
}
```

**Lines 132-144:** Caption Validation
- **Empty caption check**: Prevents notices without descriptions
- **Trim check**: Handles whitespace-only captions
- **User feedback**: Clear instructions on required format
- **Early return**: Stops processing to save resources

**Lines 146-157:** Format Validation
- **timeInfo.valid check**: Ensures caption follows pattern rules
- **Detailed feedback**: Explains what went wrong and how to fix
- **Consistent messaging**: Same format as missing caption warning

**Lines 159-171:** Capacity Management
- **MAX_NOTICES check**: Prevents system overload
- **User guidance**: Provides options to resolve capacity issue
- **Resource protection**: Limits memory and storage usage

**Lines 173-179:** File Handling
- **Base64 conversion**: Convert WhatsApp media to binary buffer
- **UUID filename**: Unique filename prevents conflicts
- **Path joining**: Cross-platform safe file path creation
- **Immediate save**: Store original before processing

**Lines 181-190:** Notice Object Creation
- **Comprehensive metadata**: ID, path, expiry, caption, duration, alert status
- **UUID generation**: Unique identifier for tracking
- **Timestamp**: Creation time for debugging
- **Creator tracking**: Record who sent notice

**Lines 192-201:** User Confirmation
- **Conditional response**: Different messages for alerts vs. timed notices
- **Notice ID**: Shortened UUID for user reference
- **Capacity status**: Shows current/max notices
- **Clear confirmation**: User knows notice is active

**Lines 203-209:** Error Handling
- **Try-catch**: Prevents crashes from processing errors
- **User notification**: Friendly error message
- **Console logging**: Technical details for debugging

**Why this design:**
- **User-friendly**: Clear validation messages with examples
- **Robust**: Multiple validation layers prevent issues
- **Scalable**: Array-based system supports multiple notices
- **Trackable**: UUIDs enable precise notice management

### Lines 212-251: Expired Notice Cleanup
```javascript
// Clean expired notices
function cleanExpiredNotices() {
  const now = Date.now();
  const expiredNotices = [];
  
  // Find expired notices (excluding alerts)
  for (let i = 0; i < currentNotices.length; i++) {
    const notice = currentNotices[i];
    
    // Don't clean up alerts - they have no expiry
    if (notice.isAlert) {
      continue;
    }
    
    // Check if notice has expired
    if (notice.expiresAt && now > notice.expiresAt) {
      expiredNotices.push(notice);
    }
  }
  
  // Remove expired notices
  for (const expiredNotice of expiredNotices) {
    // Remove image file
    if (expiredNotice.imagePath && fs.existsSync(expiredNotice.imagePath)) {
      fs.removeSync(expiredNotice.imagePath);
      console.log(`Removed expired notice image: ${expiredNotice.id.substring(0, 8)}`);
    }
    
    // Remove from array
    const index = currentNotices.indexOf(expiredNotice);
    if (index > -1) {
      currentNotices.splice(index, 1);
      console.log(`Removed expired notice: ${expiredNotice.id.substring(0, 8)}`);
    }
  }
  
  if (expiredNotices.length > 0) {
    console.log(`Cleaned up ${expiredNotices.length} expired notices. Active notices: ${currentNotices.length}/${MAX_NOTICES}`);
  }
}
```

**Lines 214-219:** Expired Notice Detection
- **Current time**: Get timestamp for comparison
- **Array iteration**: Check each notice individually
- **Alert protection**: Skip alerts (they don't expire)
- **Expiry check**: Compare notice expiry with current time

**Lines 221-231:** File Cleanup
- **File existence check**: Ensure file exists before deletion
- **Synchronous removal**: Immediate cleanup
- **Logging**: Track which files were removed
- **ID shortening**: User-friendly logging

**Lines 233-242:** Array Management
- **Index finding**: Locate expired notice in array
- **Splice removal**: Remove from active notices array
- **Safety check**: Ensure index is valid before removal
- **Logging**: Track array changes

**Lines 244-250:** Activity Reporting
- **Conditional logging**: Only report when cleanup occurs
- **Statistics**: Show cleaned count and remaining capacity
- **User transparency**: Clear indication of system activity

**Why this design:**
- **Automatic**: No manual intervention required
- **Selective**: Preserves important alerts
- **Efficient**: Batch processing reduces system calls
- **Logged**: Complete audit trail of cleanup activities

### Lines 253-275: Image Processing
```javascript
// Process received image
async function processImage(message, imagePath) {
  try {
    // Optimize image for kiosk display
    const optimizedPath = imagePath.replace('.jpg', '-optimized.jpg');
    await sharp(imagePath)
      .resize(1920, 1080, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ 
        quality: 80,
        progressive: true 
      })
      .toFile(optimizedPath);
    
    console.log(`Image optimized: ${optimizedPath}`);
    
    // Remove original image to save space
    fs.removeSync(imagePath);
    
    return optimizedPath;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}
```

**Lines 258-267:** Sharp Image Optimization
- **Resize to 1920x1080**: Standard HD resolution for kiosks
- **fit: 'inside'**: Maintains aspect ratio, fits within bounds
- **withoutEnlargement**: Don't upscale small images
- **JPEG quality 80%**: Balance between quality and file size
- **Progressive JPEG**: Faster loading on slow connections

**Lines 269-271:** Storage Management
- **Original deletion**: Remove unoptimized file to save space
- **Return optimized path**: Use processed image for display
- **Error propagation**: Let calling function handle failures

**Why this design:**
- **Performance**: Optimized images load faster on kiosk
- **Storage efficiency**: Smaller files save disk space
- **Consistency**: All notices have same resolution
- **Quality control**: Standardized appearance across devices

---

## WhatsApp Event Handlers

### Lines 280-290: Authentication Events
```javascript
// QR Code generation
client.on('qr', async (qr) => {
  console.log('QR Code received (attempt first)');
  
  try {
    // Generate QR code image
    await qrcode.toFile('./public/qr.png', qr, {
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('QR code ready at: http://localhost:3001/qr.png');
    
    // Auto-refresh QR after 20 seconds
    setTimeout(() => {
      console.log('QR code expired, generating new one...');
    }, 20000);
    
  } catch (error) {
    console.error('Error generating QR code:', error);
  }
});
```

**Lines 281-283:** QR Reception
- **Event listener**: Triggered when WhatsApp needs authentication
- **First attempt**: Indicates initial QR generation
- **Async handling**: QR generation is non-blocking

**Lines 285-294:** QR Code Generation
- **qrcode.toFile()**: Convert QR data to PNG image
- **Color scheme**: Black on white for maximum contrast
- **File location**: Public directory for web access
- **URL generation**: Provide direct access URL

**Lines 296-299:** Auto-Refresh Timer
- **20-second timeout**: QR codes expire for security
- **Automatic refresh**: Generate new QR without user action
- **User guidance**: Clear indication of expiration

**Why this design:**
- **Security**: QR codes expire to prevent unauthorized access
- **User-friendly**: Automatic refresh reduces manual steps
- **Accessibility**: QR available via HTTP for easy scanning

### Lines 301-311: Loading Screen Handler
```javascript
client.on('loading_screen', (percent, message) => {
  console.log(`Loading WhatsApp: ${percent}% - ${message}`);
});
```

**Purpose**: Show WhatsApp connection progress
- **Percentage**: Visual progress indicator
- **Message**: Detailed status information
- **Debugging**: Track connection issues

### Lines 313-317: Authentication Failure
```javascript
client.on('auth_failure', msg => {
  console.error('Authentication failed:', msg);
  console.log('Try deleting .wwebjs_auth folder and restart');
});
```

**Error handling**: Authentication problems
- **Error logging**: Capture failure details
- **User guidance**: Clear resolution steps
- **Common issue**: Session corruption requires cleanup

### Lines 319-322: Disconnection Handler
```javascript
client.on('disconnected', reason => {
  console.log('WhatsApp disconnected:', reason);
  console.log('Bot disconnected - server remains running');
  // Removed auto-restart - server stays running
});
```

**Graceful handling**: Connection loss
- **Reason logging**: Capture disconnection cause
- **Server stability**: Bot can reconnect without server restart
- **Design decision**: Manual reconnection preferred over automatic

### Lines 324-329: Ready State Handler
```javascript
client.on('ready', () => {
  console.log('WhatsApp client is ready!');
  console.log('Bot is now active and listening for messages...');
});
```

**Success indicator**: Bot is operational
- **Confirmation**: WhatsApp connection established
- **User notification**: Bot ready for commands
- **State tracking**: Clear operational status

### Lines 331-334: Message Acknowledgment
```javascript
client.on('message_ack', (msg, ack) => {
  console.log(`Message ACK: ${ack.type} for message ${msg.id._serialized}`);
});
```

**Delivery tracking**: Message status
- **ACK types**: Sent, delivered, read, etc.
- **Message ID**: Track specific message delivery
- **Debugging**: Monitor message flow

### Lines 336-338: Whitelist Configuration
```javascript
// Whitelisted recipient - only process messages sent to this group
const WHITELISTED_RECIPIENT = '146136966922311@lid'; // Your specific group ID
```

**Security measure**: Message filtering
- **Group ID**: Specific target group for notices
- **Spam prevention**: Ignore messages from other sources
- **Configurable**: Easy to change target group

### Lines 340-425: Message Processing Handler
```javascript
// Handle message creation events - PROCESS MESSAGES SENT FROM LINKED DEVICES
client.on('message_create', async (message) => {
  console.log(`Message created: "${message.body}" fromMe: ${message.fromMe} to: ${message.to}`);
  
  // ONLY process messages sent FROM the bot's account (from linked devices)
  if (!message.fromMe) {
    console.log('Ignoring message sent TO bot (not FROM linked device)');
    return;
  }
  
  // ONLY process messages sent to the whitelisted recipient
  if (message.to !== WHITELISTED_RECIPIENT) {
    console.log(`Ignoring message sent to ${message.to} (not whitelisted)`);
    return;
  }
  
  console.log(`Processing message sent to whitelisted recipient: ${WHITELISTED_RECIPIENT}`);
  
  if (message.hasMedia) {
    try {
      console.log('Downloading media...');
      const media = await message.downloadMedia();
      console.log(`Media downloaded: ${media?.mimetype}`);
      
      if (media && media.mimetype.startsWith('image/')) {
        console.log('Image detected, processing...');
        await processImageMessage(message, media);
      } else {
        // Send warning message for non-image files
        console.log(`Non-image file detected: ${media?.mimetype}`);
        const warningMessage = `⚠️ Invalid File Type Detected\n\nPlease send only IMAGE files for notice display.\n\nSupported formats:\n• JPG/JPEG\n• PNG\n\nTo set a notice:\n1. Send an image\n2. Add caption with duration (e.g., #1d, #2h, #30m)\n3. For permanent alerts, add caption #alert`;
        
        message.reply(warningMessage);
        console.log('Sent warning message for invalid file type');
      }
    } catch (error) {
      console.error('Error downloading media:', error);
    }
  } else {
    console.log('Text message');
    // Handle text commands
    const body = message.body.toLowerCase();
    if (body === '/status') {
      if (currentNotices.length > 0) {
        let statusText = `📋 Current Notices (${currentNotices.length}/${MAX_NOTICES}):\n\n`;
        
        currentNotices.forEach((notice, index) => {
          const timeLeft = notice.isAlert ? 'Permanent' : Math.max(0, notice.expiresAt - Date.now());
          const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          
          statusText += `${index + 1}. ${notice.id.substring(0, 8)}\n`;
          statusText += `   Caption: ${notice.caption}\n`;
          statusText += `   Type: ${notice.isAlert ? '🚨 Alert' : '⏰ Timed'}\n`;
          statusText += `   Status: ${notice.isAlert ? 'Permanent' : `${hoursLeft}h ${minutesLeft}m remaining`}\n`;
          statusText += `   Expires: ${notice.isAlert ? 'Never' : new Date(notice.expiresAt).toLocaleString()}\n\n`;
        });
        
        message.reply(statusText);
      } else {
        message.reply('📋 No active notices currently displayed.\n\nSend an image with caption to add a notice!');
      }
    } else if (body === '/clear') {
      // Remove all notices and their files
      let clearedCount = 0;
      currentNotices.forEach(notice => {
        if (notice.imagePath && fs.existsSync(notice.imagePath)) {
          fs.removeSync(notice.imagePath);
          clearedCount++;
        }
      });
      
      currentNotices = [];
      message.reply(`🧹 Cleared all notices!\n\nRemoved ${clearedCount} notice images.\nTotal active notices: 0/${MAX_NOTICES}\n\nSend new images to add fresh notices.`);
      console.log(`Cleared all ${clearedCount} notices by command`);
    } else if (body === '/clear-expired') {
      // Clean expired notices manually
      const beforeCount = currentNotices.length;
      cleanExpiredNotices();
      const afterCount = currentNotices.length;
      const clearedCount = beforeCount - afterCount;
      
      if (clearedCount > 0) {
        message.reply(`🧹 Cleared ${clearedCount} expired notices!\n\nActive notices: ${afterCount}/${MAX_NOTICES}`);
      } else {
        message.reply(`✨ No expired notices to clear.\n\nActive notices: ${afterCount}/${MAX_NOTICES}`);
      }
    } else if (body === '/help') {
      const helpText = `🤖 Hostel Notice Bot Help (Multi-Notice Mode)\n\n📤 Send an image with caption:\n   • #1d - Display for 1 day\n   • #2h - Display for 2 hours\n   • #30m - Display for 30 minutes\n   • #60s - Display for 60 seconds\n   • #alert - Permanent alert\n\n📋 Commands:\n   • /status - Show all active notices\n   • /clear - Remove ALL notices\n   • /clear-expired - Remove only expired notices\n   • /help - Show this help\n\n📊 Capacity: ${MAX_NOTICES} notices max\n⚠️ Expired notices auto-delete every minute`;
      message.reply(helpText);
    }
  }
});
```

**Lines 341-345:** Message Direction Filter
- **fromMe check**: Only process messages sent by the bot
- **Security**: Prevent processing incoming messages
- **Linked device logic**: Ensures control from authorized device

**Lines 347-351:** Recipient Filter
- **Whitelist check**: Only process messages to target group
- **Spam prevention**: Ignore messages to other contacts/groups
- **Logging**: Track filtered messages for debugging

**Lines 353-369:** Media Processing
- **Media detection**: Check if message contains files
- **Download handling**: Get media data safely
- **MIME type check**: Validate file type
- **Image processing**: Route valid images to processor

**Lines 371-384:** File Type Validation
- **Non-image handling**: Reject unsupported file types
- **User guidance**: Clear instructions on supported formats
- **Error prevention**: Stop processing invalid files
- **Helpful feedback**: Include examples of correct usage

**Lines 386-424:** Command Processing
- **Text message detection**: Handle bot commands
- **Case normalization**: Convert to lowercase for matching
- **Command routing**: Different actions for different commands

**Status Command (/status):**
- **Notice enumeration**: List all active notices
- **Time calculation**: Show remaining time for each
- **Alert handling**: Special display for permanent notices
- **Empty state**: Clear message when no notices

**Clear Command (/clear):**
- **Mass deletion**: Remove all notices at once
- **File cleanup**: Delete associated image files
- **Confirmation**: Report how many were removed
- **Reset state**: Empty the notices array

**Clear-Expired Command (/clear-expired):**
- **Selective cleanup**: Only remove expired notices
- **Manual trigger**: Force cleanup before automatic cycle
- **Progress reporting**: Show results of cleanup
- **No-op handling**: Message when nothing to clear

**Help Command (/help):**
- **Comprehensive guide**: Show all available features
- **Format examples**: Clear usage instructions
- **Capacity info**: Show system limits
- **Auto-cleanup notice**: Explain automatic behavior

**Why this design:**
- **Secure**: Multiple layers of message filtering
- **User-friendly**: Clear commands with helpful responses
- **Flexible**: Support multiple use cases
- **Robust**: Comprehensive error handling

---

## API Endpoints

### Lines 458-489: Current Notices API
```javascript
// API Endpoints for kiosk
app.get('/api/kiosk/current-notice', (req, res) => {
  cleanExpiredNotices();
  
  if (currentNotices.length > 0) {
    // Return all active notices
    const noticesData = currentNotices.map(notice => ({
      id: notice.id,
      noticeUrl: `/notices/${path.basename(notice.imagePath)}`,
      expiresAt: notice.expiresAt,
      caption: notice.caption,
      duration: notice.duration,
      isAlert: notice.isAlert,
      createdAt: notice.createdAt,
      createdBy: notice.createdBy
    }));
    
    res.json({
      success: true,
      notices: noticesData,
      totalCount: currentNotices.length,
      maxCount: MAX_NOTICES
    });
  } else {
    res.json({
      success: false,
      message: 'No active notices',
      notices: [],
      totalCount: 0,
      maxCount: MAX_NOTICES
    });
  }
});
```

**Lines 459:** Auto-cleanup Trigger
- **cleanExpiredNotices()**: Remove expired notices before response
- **Fresh data**: Ensure kiosk gets current state
- **Prevention**: Avoid serving expired content

**Lines 461-472:** Data Transformation
- **Array mapping**: Convert internal notice objects to API format
- **URL generation**: Create accessible image URLs
- **Metadata inclusion**: All relevant notice information
- **Path handling**: Extract filename for web access

**Lines 474-488:** Response Structure
- **Success response**: Include notices array and metadata
- **Capacity info**: Current count and maximum limit
- **Error response**: Clear indication when no notices
- **Consistent format**: Standard JSON structure

### Lines 491-502: Individual Notice Image API
```javascript
app.get('/api/kiosk/notice-image/:id', (req, res) => {
  cleanExpiredNotices();
  
  const noticeId = req.params.id;
  const notice = currentNotices.find(n => n.id.includes(noticeId));
  
  if (notice && notice.imagePath && fs.existsSync(notice.imagePath)) {
    res.sendFile(notice.imagePath);
  } else {
    res.status(404).json({ error: 'Notice image not found' });
  }
});
```

**Lines 492:** Parameter Extraction
- **req.params.id**: Get notice ID from URL
- **Partial matching**: Allow short ID matching
- **Flexible lookup**: Support different ID formats

**Lines 494-497:** Notice Lookup
- **Array find**: Search for matching notice
- **ID inclusion**: Partial match for user-friendly IDs
- **File existence**: Verify image exists before serving

**Lines 498-501:** Response Handling
- **File serving**: Send image file directly
- **Error response**: 404 for missing images
- **MIME handling**: Express handles content type

### Lines 504-529: All Notices Metadata API
```javascript
app.get('/api/kiosk/all-notices-images', (req, res) => {
  cleanExpiredNotices();
  
  if (currentNotices.length > 0) {
    const imageData = currentNotices.map(notice => ({
      id: notice.id,
      caption: notice.caption,
      isAlert: notice.isAlert,
      expiresAt: notice.expiresAt,
      imageUrl: `/api/kiosk/notice-image/${notice.id.substring(0, 8)}`
    }));
    
    res.json({
      success: true,
      notices: imageData,
      totalCount: currentNotices.length
    });
  } else {
    res.json({
      success: false,
      message: 'No active notices',
      notices: [],
      totalCount: 0
    });
  }
});
```

**Purpose**: Provide metadata for all notices
- **Lightweight response**: No image data, just metadata
- **URL generation**: Create image access links
- **ID shortening**: User-friendly 8-character IDs
- **Carousel support**: Enable notice navigation

### Lines 531-537: Health Check API
```javascript
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    whatsappReady: client.info ? true : false
  });
});
```

**Monitoring endpoint**: System status
- **Status indicator**: Basic health check
- **Timestamp**: Current server time
- **WhatsApp status**: Connection state monitoring
- **Load balancer support**: Standard health check format

### Lines 539-609: WhatsApp Control APIs
```javascript
// WhatsApp control endpoints
app.get('/api/whatsapp/qr', (req, res) => {
  const qrPath = path.join(__dirname, 'public', 'qr.png');
  
  if (fs.existsSync(qrPath)) {
    // Send QR code as image data for React
    const qrImage = fs.readFileSync(qrPath);
    res.setHeader('Content-Type', 'image/png');
    res.send(qrImage);
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'QR code not available',
      message: 'Please initialize WhatsApp connection first'
    });
  }
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    connected: client.info ? true : false,
    ready: client.info !== null,
    phone: client.info?.me?.user || null,
    state: client.info ? 'CONNECTED' : 'DISCONNECTED'
  });
});
```

**QR Code Endpoint**: Serve authentication QR
- **Image serving**: Direct PNG response
- **Error handling**: Clear message when QR unavailable
- **React compatibility**: Direct image data response

**Status Endpoint**: Connection information
- **Connection state**: Boolean and text status
- **Phone number**: Connected account information
- **State string**: Human-readable status

### Lines 611-655: Server-Sent Events API
```javascript
// Server-Sent Events endpoint for real-time updates
app.get('/api/whatsapp/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial status
  res.write(`data: ${JSON.stringify({
    type: 'status',
    connected: client.info ? true : false,
    state: client.info ? 'CONNECTED' : 'DISCONNECTED'
  })}\n\n`);

  // Store the response to send updates later
  let eventResponse = res;

  // Listen for WhatsApp events and send to client
  const onQR = () => {
    if (eventResponse && !eventResponse.destroyed) {
      eventResponse.write(`data: ${JSON.stringify({
        type: 'qr',
        connected: false,
        state: 'QR_RECEIVED'
      })}\n\n`);
    }
  };

  const onReady = () => {
    if (eventResponse && !eventResponse.destroyed) {
      eventResponse.write(`data: ${JSON.stringify({
        type: 'connected',
        connected: true,
        state: 'CONNECTED'
      })}\n\n`);
    }
  };

  const onDisconnected = () => {
    if (eventResponse && !eventResponse.destroyed) {
      eventResponse.write(`data: ${JSON.stringify({
        type: 'disconnected',
        connected: false,
        state: 'DISCONNECTED'
      })}\n\n`);
    }
  };

  client.on('qr', onQR);
  client.on('ready', onReady);
  client.on('disconnected', onDisconnected);

  // Clean up on client disconnect
  req.on('close', () => {
    client.removeListener('qr', onQR);
    client.removeListener('ready', onReady);
    client.removeListener('disconnected', onDisconnected);
    eventResponse = null;
  });
});
```

**Lines 612-616:** SSE Headers
- **Content-Type**: Server-Sent Events MIME type
- **Cache control**: Prevent caching of real-time data
- **Connection**: Keep-alive for persistent connection
- **CORS**: Allow cross-origin SSE connections

**Lines 618-622:** Initial Status
- **Immediate response**: Send current state on connection
- **JSON format**: Structured event data
- **Double newline**: SSE message delimiter

**Lines 624-650:** Event Listeners
- **QR events**: Notify when new QR available
- **Ready events**: Notify when WhatsApp connects
- **Disconnect events**: Notify when connection lost
- **Safety checks**: Prevent writing to closed connections

**Lines 652-658:** Cleanup Handling
- **Event removal**: Clean up listeners on disconnect
- **Memory management**: Prevent memory leaks
- **Reference clearing**: Remove response reference
- **Robustness**: Handle client disconnections gracefully

**Why SSE design:**
- **Real-time**: Instant UI updates without polling
- **Efficient**: Single connection for multiple updates
- **React-friendly**: Easy integration with frontend
- **Scalable**: Low overhead for many clients

---

## Server Startup

### Lines 660-670: Server Initialization
```javascript
// Cleanup expired notices every minute
setInterval(cleanExpiredNotices, 60000);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://10.0.8.126:${PORT}`);
  console.log('WhatsApp client ready - use web interface to connect');
});
```

**Line 661:** Automatic Cleanup
- **setInterval**: Run cleanup every 60 seconds
- **60000ms**: One minute intervals
- **Background process**: Non-blocking operation

**Lines 663-668:** Server Start
- **app.listen()**: Start Express server
- **0.0.0.0**: Bind to all network interfaces
- **PORT variable**: Use configured port (3001)
- **Console output**: User-friendly startup messages

**Network Addresses:**
- **localhost**: Local development access
- **10.0.8.126**: Network IP for other devices
- **Port 3001**: Consistent endpoint for API access

### Lines 672-677: Graceful Shutdown
```javascript
// Shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await client.destroy();
  process.exit(0);
});
```

**Signal handling**: Clean server shutdown
- **SIGINT**: Ctrl+C interrupt signal
- **Client cleanup**: Properly disconnect WhatsApp
- **Process exit**: Clean termination
- **Async handling**: Wait for cleanup completion

---

## Design Philosophy and Best Practices

### Security Considerations
1. **Message Filtering**: Only process whitelisted recipients
2. **Direction Control**: Only process sent messages (not received)
3. **File Type Validation**: Reject non-image files
4. **Input Sanitization**: Validate caption formats
5. **Rate Limiting**: Capacity limits prevent abuse

### Performance Optimizations
1. **Image Processing**: Resize and compress for kiosk display
2. **Automatic Cleanup**: Remove expired notices to free resources
3. **Efficient Storage**: Delete original images after optimization
4. **Event-Driven**: React to WhatsApp events in real-time
5. **Caching**: Serve static files efficiently

### User Experience Design
1. **Clear Feedback**: Detailed success/error messages
2. **Help Commands**: Built-in documentation
3. **Status Tracking**: Real-time notice information
4. **Flexible Formats**: Multiple time duration options
5. **Error Recovery**: Graceful handling of issues

### Scalability Features
1. **Multi-Notice Support**: Handle multiple simultaneous notices
2. **Configurable Limits**: Easy capacity adjustment
3. **Modular Functions**: Reusable code components
4. **API Design**: RESTful endpoints for integration
5. **Real-Time Updates**: Server-Sent Events for live UI

### Maintenance and Monitoring
1. **Comprehensive Logging**: Track all system activities
2. **Health Checks**: Monitor system status
3. **Automatic Cleanup**: Reduce manual maintenance
4. **Error Handling**: Prevent system crashes
5. **Debug Information**: Detailed troubleshooting data

---

## Common Questions and Answers

### Q: Why use arrays instead of single notice object?
A: Arrays support multiple simultaneous notices, enabling carousel display and better utilization of kiosk screen space.

### Q: Why validate captions so strictly?
A: Prevents malformed notices, ensures consistent behavior, and provides clear user feedback for corrections.

### Q: Why use LocalAuth strategy?
A: Saves session locally for automatic reconnection, eliminating need to scan QR code on every restart.

### Q: Why optimize images with Sharp?
A: Reduces file size, standardizes resolution, and improves loading performance on kiosk displays.

### Q: Why use Server-Sent Events instead of polling?
A: Provides real-time updates with lower overhead and instant UI responsiveness.

### Q: Why limit to 5 notices?
A: Balances functionality with performance, prevents system overload, and maintains manageable user experience.

### Q: Why filter messages by recipient?
A: Security measure to ensure only authorized notices are processed, preventing spam and unauthorized content.

---

This documentation provides a comprehensive understanding of every aspect of the WhatsApp bot server, enabling detailed technical discussions and modifications.
