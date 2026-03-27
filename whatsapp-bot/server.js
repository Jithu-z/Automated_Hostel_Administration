const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');

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

// Ensure directories exist
const NOTICE_DIR = path.join(__dirname, 'public', 'notices');
const QRCODE_DIR = path.join(__dirname, 'public', 'qrcodes');

fs.ensureDirSync(NOTICE_DIR);
fs.ensureDirSync(QRCODE_DIR);

// File storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, NOTICE_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}-${Date.now()}.jpg`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

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

// Current notice state
let currentNotice = {
  imagePath: null,
  expiresAt: null,
  caption: '',
  duration: null,
  isAlert: false
};

// Parse time from caption
function parseTimeFromCaption(caption) {
  console.log(`Parsing time from caption: "${caption}"`);
  
  // Check for #alert keyword first
  if (caption.includes('#alert')) {
    console.log('Found #alert keyword - setting permanent notice mode');
    return {
      duration: '♾️', // No expiry
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
  
  // No valid pattern found - return default with valid: false
  console.log(`No time pattern found, using default`);
  return { 
    duration: 24 * 60 * 60 * 1000, 
    unit: 'days', 
    value: 1,
    isAlert: false,
    valid: false // Mark as invalid since no time pattern was found
  };
}

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
    
    // Save image
    const buffer = Buffer.from(media.data, 'base64');
    const filename = `${uuidv4()}-${Date.now()}.jpg`;
    const imagePath = path.join(NOTICE_DIR, filename);
    
    fs.writeFileSync(imagePath, buffer);
    console.log(`Image saved: ${filename}`);
    
    // Process and optimize image
    const processedPath = await processImage(message, imagePath);
    
    // Calculate expiry time (null for alerts)
    const expiresAt = timeInfo.isAlert ? 0 : Date.now() + timeInfo.duration;
    
    // Clean previous notice
    if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
      fs.removeSync(currentNotice.imagePath);
    }
    
    // Update current notice
    currentNotice = {
      imagePath: processedPath,
      expiresAt: expiresAt,
      caption: message.body,
      duration: timeInfo,
      isAlert: timeInfo.isAlert
    };
    
    // Send confirmation based on alert mode
    let reply;
    if (timeInfo.isAlert) {
      reply = `🚨 ALERT NOTICE SET!\n\nThis notice will remain permanently until replaced.\nNo expiry time set.\n\nYour alert is now displayed on the kiosk.`;
    } else {
      reply = `Notice updated successfully!\n\nDuration: ${timeInfo.value} ${timeInfo.unit}\nExpires: ${new Date(expiresAt).toLocaleString()}\n\nYour notice is now displayed on the kiosk.`;
    }
    message.reply(reply);
    
    console.log(`Notice updated: ${processedPath}, ${timeInfo.isAlert ? 'ALERT MODE - No expiry' : `expires in ${timeInfo.value} ${timeInfo.unit}`}`);
    
  } catch (error) {
    console.error('Error processing image message:', error);
    message.reply('Sorry, there was an error processing your image. Please try again.');
  }
}

// Clean expired notices
function cleanExpiredNotices() {
  // Don't clean up alerts - they have no expiry
  if (currentNotice.isAlert) {
    return;
  }
  
  if (currentNotice.expiresAt && Date.now() > currentNotice.expiresAt) {
    if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
      fs.removeSync(currentNotice.imagePath);
    }
    currentNotice = {
      imagePath: null,
      expiresAt: null,
      caption: '',
      duration: null,
      isAlert: false
    };
    console.log('Expired notice cleaned up');
  }
}

// Process received image (sharp)
async function processImage(message, imagePath) {
  try {
    // Optimize image for kiosk display
    const optimizedPath = imagePath.replace('.jpg', '-optimized.jpg');
    await sharp(imagePath)
      .resize(1920, 1080, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toFile(optimizedPath);

    // Remove original
    fs.removeSync(imagePath);
    
    return optimizedPath;
  } catch (error) {
    console.error('Error processing image:', error);
    return imagePath; // Return original if processing fails
  }
}

// WhatsApp event handlers
client.on('qr', async (qr) => {
  console.log('QR Code received (attempt ' + (client.info ? 'retry' : 'first') + ')');
  console.log('Open http://localhost:3001/qr.png to scan');
  console.log('QR expires in 20 seconds - scan quickly!');
  
  // Generate QR code and save as image
  try {
    const qrImagePath = path.join(__dirname, 'public', 'qr.png');
    await qrcode.toFile(qrImagePath, qr, {
      width: 300,
      margin: 2,
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

client.on('loading_screen', (percent, message) => {
  console.log(`Loading WhatsApp: ${percent}% - ${message}`);
});

client.on('auth_failure', msg => {
  console.error('Authentication failed:', msg);
  console.log('Try deleting .wwebjs_auth folder and restart');
});

client.on('disconnected', reason => {
  console.log('WhatsApp disconnected:', reason);
  console.log('Bot disconnected - server remains running');
  // Removed auto-restart - server stays running
});

client.on('ready', () => {
  console.log('WhatsApp client is ready!');
  console.log('Bot is now active and listening for messages...');
});

// Handle message acknowledgments (for encrypted messages)
client.on('message_ack', (msg, ack) => {
  console.log(`Message ACK: ${ack.type} for message ${msg.id._serialized}`);
});

// Whitelisted recipient - only process messages sent to this group
const WHITELISTED_RECIPIENT = '146136966922311@lid'; // specific group ID

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
      if (currentNotice.imagePath) {
        let timeRemaining, expiresText;
        
        if (currentNotice.isAlert) {
          timeRemaining = 'Permanent';
          expiresText = 'Never';
        } else {
          const timeLeft = Math.max(0, currentNotice.expiresAt - Date.now());
          const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
          const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = `${hoursLeft}h ${minutesLeft}m`;
          expiresText = new Date(currentNotice.expiresAt).toLocaleString();
        }
        
        const reply = `Current Notice Status:\n\nActive: Yes\nTime remaining: ${timeRemaining}\nCaption: ${currentNotice.caption}\n\nExpires: ${expiresText}`;
        message.reply(reply);
      } else {
        message.reply('No active notice currently displayed.');
      }
    } else if (body === '/clear') {
      if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
        fs.removeSync(currentNotice.imagePath);
      }
      currentNotice = {
        imagePath: null,
        expiresAt: null,
        caption: '',
        duration: null
      };
      message.reply('Notice cleared from kiosk display.');
      console.log('Notice cleared by command');
    } else if (body === '/start') {
      const StartText = ` No functionalities for /start command\n Type /help to see available commands`;
      message.reply(StartText);
    } else if (body === '/help') {
      const helpText = `Hostel Notice Bot Help:\n\nSend an image with caption:\n   • #1d - Display for 1 day\n   • #2h - Display for 2 hours\n   • #30m - Display for 30 minutes\n   • #60s - Display for 60 seconds\n\nCommands:\n   • /status - Check current notice\n   • /clear - Remove current notice\n   • /help - Show this help`;
      message.reply(helpText);
    }
  }
});

// message_sent event for linked device messages
client.on('message_sent', async (message) => {
  console.log(`Message sent: "${message.body}" to ${message.to}`);
  
  if (message.hasMedia) {
    try {
      const media = await message.downloadMedia();
      if (media && media.mimetype.startsWith('image/')) {
        console.log('Image from message_sent, processing...');
        await processImageMessage(message, media);
      } else {
        // Send warning message for non-image files
        console.log(`Non-image file detected in message_sent: ${media?.mimetype}`);
        const warningMessage = `⚠️ Invalid File Type Detected\n\nPlease send only IMAGE files for notice display.\n\nSupported formats:\n• JPG/JPEG\n• PNG\n\nTo set a notice:\n1. Send an image\n2. Add caption with duration (e.g., #1d, #2h, #30m,#20s)\n3. For permanent alerts, add caption #alert`;
        
        message.reply(warningMessage);
        console.log('Sent warning message for invalid file type (message_sent)');
      }
    } catch (error) {
      console.error('Error with message_sent:', error);
    }
  }
});

client.on('message', async (message) => {
  // Ignore incoming messages - only process messages sent FROM linked devices
  console.log(`Ignoring incoming message from: ${message.from}`);
});

// API Endpoints for kiosk
app.get('/api/kiosk/current-notice', (req, res) => {
  cleanExpiredNotices();
  
  if (currentNotice.imagePath) {
    const filename = path.basename(currentNotice.imagePath);
    res.json({
      success: true,
      noticeUrl: `/notices/${filename}`,
      expiresAt: currentNotice.expiresAt,
      caption: currentNotice.caption,
      duration: currentNotice.duration,
      isAlert: currentNotice.isAlert
    });
  } else {
    res.json({
      success: false,
      message: 'No active notice'
    });
  }
});

app.get('/api/kiosk/notice-image', (req, res) => {
  cleanExpiredNotices();
  
  if (currentNotice.imagePath && fs.existsSync(currentNotice.imagePath)) {
    res.sendFile(currentNotice.imagePath);
  } else {
    res.status(404).json({ error: 'No notice image found' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    whatsappReady: client.info ? true : false
  });
});

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

  app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
      console.log('Disconnecting WhatsApp client...');
      
      // Force logout with multiple methods
      if (client.info) {
        try {
          console.log('Attempting logout...');
          
          // Method 1: Try direct logout
          await client.logout();
          console.log('Logout method 1 completed');
        } catch (logoutError1) {
          console.log('Logout method 1 failed:', logoutError1.message);
          
          try {
            // Method 2: Use page evaluation to force logout
            const page = await client.pupPage;
            if (page) {
              await page.evaluate(() => {
                // Find and click logout/leave button in WhatsApp UI
                const logoutBtn = document.querySelector('[data-icon="logout"], [title*="Log out"], [aria-label*="Log out"]');
                if (logoutBtn) {
                  logoutBtn.click();
                }
              });
              console.log('Logout method 2 completed');
            }
          } catch (logoutError2) {
            console.log('Logout method 2 failed:', logoutError2.message);
          }
        }
      }
      
      // Wait a moment for logout to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Destroy client
      await client.destroy();
      console.log('Client destroyed');
      
      // Send response after all cleanup is done
      res.json({ success: true, message: 'WhatsApp disconnected successfully' });
      
      // Force kill any remaining Chrome processes
      const { exec } = require('child_process');
      exec('taskkill /IM chrome.exe /F 2>nul', (error) => {
        if (error) {
          console.log('No Chrome processes to kill');
        } else {
          console.log('Killed remaining Chrome processes');
        }
      });
      
      // Clean up session data completely
      const fs = require('fs-extra');
      const path = require('path');
      const authPath = path.join(__dirname, '.wwebjs_auth');
      if (fs.existsSync(authPath)) {
        fs.removeSync(authPath);
        console.log('Cleaned up session data');
      }
      
      // Reset QR code
      const qrPath = path.join(__dirname, 'public', 'qr.png');
      if (fs.existsSync(qrPath)) {
        fs.removeSync(qrPath);
        console.log('Removed QR code');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      res.status(500).json({ success: false, error: 'Failed to disconnect' });
    }
  });

  // Cleanup expired notices every minute
  setInterval(cleanExpiredNotices, 60000);

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local: http://localhost:${PORT}`);
    console.log(`Network: http://10.0.8.126:${PORT}`);
    console.log('WhatsApp client ready - use web interface to connect');
    
  });

  // Manual WhatsApp initialization endpoint
  app.post('/api/whatsapp/connect', async (req, res) => {
    try {
      console.log('Initializing WhatsApp client...');
      await client.initialize();
      res.json({ success: true, message: 'WhatsApp initialization started' });
    } catch (error) {
      console.error('Initialization error:', error);
      res.status(500).json({ success: false, error: 'Failed to initialize WhatsApp' });
    }
  });

  // Shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await client.destroy();
    process.exit(0);
  });
