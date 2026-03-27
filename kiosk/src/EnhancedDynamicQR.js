import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import kioskImage from './defaulthostelnotice.jpeg';
import KioskGraph from './kioskgraph';
import axios from 'axios';

export default function EnhancedDynamicQr() {
  const [qrValue, setQrValue] = useState('Initial-Value');
  const [timeLeft, setTimeLeft] = useState(10);
  const [showGraph, setShowGraph] = useState(false);
  const [noticeImage, setNoticeImage] = useState(null);
  const [noticeInfo, setNoticeInfo] = useState(null);

  const serverurl = "http://10.0.9.78:3001/api/kiosk/update-code";
  const noticeApiUrl = "http://localhost:3001/api/kiosk/current-notice";

  // Fetch current notice from WhatsApp bot
  const fetchNotice = async () => {
    try {
      const response = await axios.get(noticeApiUrl);
      if (response.data.success) {
        setNoticeImage(`http://localhost:3001${response.data.noticeUrl}`);
        setNoticeInfo(response.data);
        console.log('Notice updated:', response.data);
      } else {
        setNoticeImage(null);
        setNoticeInfo(null);
      }
    } catch (error) {
      console.error('Error fetching notice:', error);
      // Fallback to default image if API is not available
      setNoticeImage(null);
    }
  };

  useEffect(() => {
    // QR Code update logic
    const getNewQRValue = async () => {
      try {
        const response = await axios.get(serverurl);
        if(response.data.success){  
          setQrValue(response.data.code);
          setTimeLeft(10);
        }
      } catch (error) {
        console.error('Error fetching new QR code:', error);
      }
    };

    // Initial calls
    getNewQRValue();
    fetchNotice();

    // Set up intervals
    const qrInterval = setInterval(getNewQRValue, 10000);
    const countdown = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 10));
    }, 1000);
    const graphInterval = setInterval(() => {
      setShowGraph((prev) => !prev);
    }, 7000);
    const noticeInterval = setInterval(fetchNotice, 30000); // Check for new notices every 30 seconds

    // Cleanup
    return () => {
      clearInterval(qrInterval);
      clearInterval(countdown);
      clearInterval(graphInterval);
      clearInterval(noticeInterval);
    };
  }, []);

  const renderNoticeContent = () => {
    // Check if this is an alert notice (no expiry)
    const isAlert = noticeInfo && noticeInfo.isAlert;
    
    // For alerts: always show notice
    // For normal notices: toggle between notice and kioskgraph
    if (noticeImage && (isAlert || !showGraph)) {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <img 
            src={noticeImage} 
            alt="WhatsApp Notice"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '100%', 
              objectFit: 'contain',
              width: 'auto',
              height: 'auto',
              display: 'block'
            }} 
          />
          {noticeInfo && noticeInfo.duration && !isAlert && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '5px 10px',
              borderRadius: '5px',
              fontSize: '0.9rem'
            }}>
              Expires: {new Date(noticeInfo.expiresAt).toLocaleTimeString()}
            </div>
          )}
          {isAlert && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'rgba(255,0,0,0.8)',
              color: 'white',
              padding: '8px 15px',
              borderRadius: '20px',
              fontSize: '1rem',
              fontWeight: 'bold',
              animation: 'pulse 2s infinite'
            }}>
              🚨 ALERT
            </div>
          )}
        </div>
      );
    }
    
    // Show kioskgraph for normal notices when toggling, or when no notice exists
    return showGraph ? (
      <KioskGraph /> 
    ) : (
      <img 
        src={kioskImage} 
        alt="Kiosk Content"
        style={{ 
          maxWidth: '100%', 
          maxHeight: '100%', 
          objectFit: 'contain',
          width: 'auto',
          height: 'auto',
          display: 'block'
        }} 
      />
    );
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100vw', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      backgroundColor: '#1a1a1a',
      color: 'white'
    }}>
      
      {/* TOP SECTION: 70% - Notice Display */}
      <div style={{ 
        flex: 7, 
        display: 'flex', 
        justifyContent: 'center',
        overflow: 'hidden', 
        alignItems: 'center', 
        backgroundColor: '#ffffff', 
        padding: '10px',
        position: 'relative'
      }}>
        {renderNoticeContent()}
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
          {noticeInfo && (
            <p style={{ fontSize: '0.9rem', color: '#25D366', margin: '5px 0' }}>
              📱 Notice via WhatsApp
            </p>
          )}
        </div>

        <div style={{ padding: '15px', border: '4px solid #f0f0f0', borderRadius: '15px' }}>
          <QRCodeSVG value={qrValue} size={window.innerHeight * 0.2} />
        </div>
      </div>
    </div>
  );
}
