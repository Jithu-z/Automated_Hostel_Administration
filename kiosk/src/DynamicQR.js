import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import kioskImage from './notice for signage.jpeg';
import axios from 'axios';

export default function DynamicQr() {
  // 1. Initialize state with a default value
  const [qrValue, setQrValue] = useState('Initial-Value');
  const [timeLeft, setTimeLeft] = useState(10);
  const serverurl="http://10.52.201.123:3001/api/kiosk/update-code";
  useEffect(() => {
    // 2. Define the logic to update the QR code
    const getNewQRValue = async () => {
      try {
        const response = await axios.get(serverurl);
        if(response.data.success){
          setQrValue(response.data.code);
          setTimeLeft(10); // Reset countdown
        }
      } catch (error) {
        console.error('Error fetching new QR code:', error);
      }}
      getNewQRValue(); // Initial call to set the QR code immediatelys
    // 3. Set the interval to run every 10 seconds
    const interval = setInterval(getNewQRValue, 10000);
    // 4. Also set a second interval just for the visual countdown timer
    const countdown = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 10));
    }, 1000);

    // 5. Cleanup both intervals when the component unmounts
    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, []);

 return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      backgroundColor: '#1a1a1a', // Dark theme looks better on Kiosks
      color: 'white'
    }}>
      
      {/* TOP SECTION: 70% IMAGE AREA */}
      <div style={{ 
        flex: 7, 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#ffffff', // Change from #1a1a1a to #ffffff
        overflow: 'hidden',      // Strictly prevents scrolling
        padding: '10px'          // Slight padding so text doesn't hit the screen edge
      }}>
        <img 
          src={kioskImage} 
          alt="Kiosk Content"
          style={{ 
            maxWidth: '100%', 
            maxHeight: '100%',
            width: 'auto', 
            height: 'auto',
            objectFit: 'contain', // Allows the image to be as long as it needs to be
            display: 'block'
          }} 
        />
      </div>

      {/* BOTTOM SECTION: 30% QR AREA */}
      <div style={{ 
        flex: 3, 
        backgroundColor: '#ffffff', 
        color: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10%',
        boxShadow: '0 -10px 20px rgba(0,0,0,0.2)',
        gap: '15px'
      }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', margin: 0 }}>Scan to Check-in</h2>
          <p style={{ fontSize: '1.2rem', color: timeLeft <= 2 ? 'red' : '#666' }}>
            New QR code in <strong>{timeLeft} seconds</strong>
          </p>
        </div>

        <div style={{ padding: '15px', border: '4px solid #f0f0f0', borderRadius: '15px' }}>
          <QRCodeSVG value={qrValue} size={window.innerHeight * 0.2} />
        </div>
      </div>
    </div>
  );
}