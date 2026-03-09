# Hostel Notice WhatsApp Bot

A zero-cost WhatsApp bot for controlling hostel kiosk notice display using WhatsApp Web JS.

## Features

- 📸 **Image Processing**: Receive and optimize images for kiosk display
- ⏰ **Time Control**: Set display duration using hashtags (#1d, #2h, #30m, #60s)
- 🤖 **Commands**: Status checking, notice clearing, help system
- 🔄 **Auto-cleanup**: Automatically removes expired notices
- 📱 **WhatsApp Web JS**: Free WhatsApp integration

## Installation

```bash
cd whatsapp-bot
npm install
```

## Usage

1. **Start the bot:**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

2. **Scan QR Code:** 
   - First time: Scan the QR code printed in console with WhatsApp Web
   - Subsequent starts: Auto-authenticates

3. **Send Notice:**
   - Send image to +1 (555) 142-3805
   - Add time hashtag in caption
   - Example: "#2h" for 2 hours

## Time Format Hashtags

| Hashtag | Duration | Example |
|---------|----------|---------|
| `#1d` | 1 day | Display for 1 day |
| `#2h` | 2 hours | Display for 2 hours |
| `#30m` | 30 minutes | Display for 30 minutes |
| `#60s` | 60 seconds | Display for 60 seconds |

## Commands

- `/status` - Check current notice status
- `/clear` - Remove current notice
- `/help` - Show help message

## API Endpoints

### Get Current Notice
```
GET /api/kiosk/current-notice
```

### Get Notice Image
```
GET /api/kiosk/notice-image
```

### Health Check
```
GET /api/health
```

## Integration with Kiosk

Update your kiosk's `DynamicQR.js` to fetch notices from this API:

```javascript
// Add to your useEffect
const fetchNotice = async () => {
  try {
    const response = await axios.get('http://localhost:3001/api/kiosk/current-notice');
    if (response.data.success) {
      setNoticeImage(response.data.noticeUrl);
    }
  } catch (error) {
    console.error('Error fetching notice:', error);
  }
};
```

## File Structure

```
whatsapp-bot/
├── server.js              # Main bot server
├── package.json           # Dependencies
├── public/
│   ├── notices/          # Stored notice images
│   └── qrcodes/          # Generated QR codes
└── README.md
```

## Security Notes

- Bot only responds to the test number: +1 (555) 142-3805
- Images are automatically optimized for kiosk display
- Expired notices are automatically cleaned up
- LocalAuth strategy maintains session between restarts

## Troubleshooting

1. **QR Code Issues**: Delete `.wwebjs_auth` folder and restart
2. **Image Not Displaying**: Check if image is optimized and path is correct
3. **Bot Not Responding**: Verify WhatsApp Web connection and test number format

## Development

The bot uses:
- **whatsapp-web.js**: WhatsApp Web automation
- **express**: Web server for API endpoints
- **sharp**: Image processing and optimization
- **multer**: File upload handling
