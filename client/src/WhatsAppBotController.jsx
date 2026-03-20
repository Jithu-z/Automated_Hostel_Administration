import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Loader2, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';

const WhatsAppBotController = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrImageSrc, setQrImageSrc] = useState('');
    const [statusText, setStatusText] = useState('Disconnected');
    const [notification, setNotification] = useState({ message: '', type: '', visible: false });
    
    const eventSourceRef = useRef(null);
    const qrRefreshIntervalRef = useRef(null);

    useEffect(() => {
        checkConnectionStatus();
        startStatusPolling();
        
        return () => {
            stopQRMonitoring();
        };
    }, []);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type, visible: true });
        setTimeout(() => {
            setNotification(prev => ({ ...prev, visible: false }));
        }, 3000);
    };

    const handleButtonClick = async () => {
        if (isConnected) {
            await disconnectBot();
        } else if (isConnecting) {
            cancelConnection();
        } else {
            await connectBot();
        }
    };

    const connectBot = async () => {
        try {
            setConnectingState();
            
            const response = await fetch('http://localhost:3001/api/whatsapp/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to start WhatsApp initialization');
            }
            
            startQRMonitoring();
            setShowQRModal(true);
            await requestQRCode();
            
        } catch (error) {
            console.error('Failed to connect:', error);
            setDisconnectedState();
            setShowQRModal(false);
            showNotification('Failed to connect. Please try again.', 'error');
        }
    };

    const disconnectBot = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/whatsapp/disconnect', { 
                method: 'POST' 
            });
            const result = await response.json();

            if (response.ok && result.success) {
                setTimeout(() => {
                    setDisconnectedState();
                }, 1000);
            }
        } catch (error) {
            console.error('Disconnect error:', error);
            setDisconnectedState();
        }
    };

    const cancelConnection = () => {
        stopQRMonitoring();
        setDisconnectedState();
        setShowQRModal(false);
    };

    const requestQRCode = async () => {
        try {
            console.log('Requesting QR code from server...');
            const response = await fetch('http://localhost:3001/api/whatsapp/qr');
            
            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                setQrImageSrc(imageUrl);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get QR code');
            }
        } catch (error) {
            console.error('QR request error:', error);
            throw error;
        }
    };

    const startQRMonitoring = () => {
        eventSourceRef.current = new EventSource('http://localhost:3001/api/whatsapp/events');
        
        eventSourceRef.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'connected' || (data.connected && data.state === 'CONNECTED')) {
                    setConnectedState();
                    setShowQRModal(false);
                    stopQRMonitoring();
                    showNotification('WhatsApp bot connected successfully!', 'success');
                }
            } catch (error) {
                console.error('Event parsing error:', error);
            }
        };
        
        eventSourceRef.current.onerror = (error) => {
            console.error('EventSource error:', error);
            startFallbackPolling();
        };
    };

    const startFallbackPolling = () => {
        qrRefreshIntervalRef.current = setInterval(async () => {
            try {
                const response = await fetch('http://localhost:3001/api/whatsapp/status');
                const data = await response.json();
                
                if (data.connected) {
                    setConnectedState();
                    setShowQRModal(false);
                    stopQRMonitoring();
                    showNotification('WhatsApp bot connected successfully!', 'success');
                }
            } catch (error) {
                console.error('Fallback polling - Status check error:', error);
            }
        }, 1000);
    };

    const stopQRMonitoring = () => {
        if (qrRefreshIntervalRef.current) {
            clearInterval(qrRefreshIntervalRef.current);
            qrRefreshIntervalRef.current = null;
        }
        
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    };

    const checkConnectionStatus = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/whatsapp/status');
            const data = await response.json();
            
            if (data.connected) {
                setConnectedState();
            } else {
                setDisconnectedState();
            }
        } catch (error) {
            console.error('Status check error:', error);
            setDisconnectedState();
        }
    };

    const startStatusPolling = () => {
        setInterval(() => {
            checkConnectionStatus();
        }, 5000);
    };

    const setConnectedState = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatusText('Connected');
    };

    const setConnectingState = () => {
        setIsConnected(false);
        setIsConnecting(true);
        setStatusText('Connecting...');
    };

    const setDisconnectedState = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusText('Disconnected');
    };

    const getStatusIcon = () => {
        if (isConnected) return <CheckCircle className="w-4 h-4 text-green-500" />;
        if (isConnecting) return <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />;
        return <WifiOff className="w-4 h-4 text-red-500" />;
    };

    const getStatusColor = () => {
        if (isConnected) return 'bg-green-100 text-green-800 border-green-200';
        if (isConnecting) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-red-100 text-red-800 border-red-200';
    };

    return (
        <>
            {/* Notification */}
            {notification.visible && (
                <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-white font-medium z-50 transition-opacity duration-300 ${
                    notification.type === 'success' ? 'bg-green-500' :
                    notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                }`}>
                    {notification.message}
                </div>
            )}

            {/* Status Indicator */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getStatusColor()} transition-colors duration-300`}>
                {getStatusIcon()}
                <span className="text-sm font-medium">{statusText}</span>
            </div>

            {/* WhatsApp Bot Button */}
            <button
                onClick={handleButtonClick}
                disabled={isConnecting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isConnected 
                        ? 'bg-red-500 hover:bg-red-600 text-white' 
                        : 'bg-green-500 hover:bg-green-600 text-white'
                } ${isConnecting ? 'opacity-75 cursor-not-allowed' : 'hover:shadow-lg'}`}
            >
                {isConnecting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        CONNECTING...
                    </>
                ) : isConnected ? (
                    <>
                        <X className="w-4 h-4" />
                        DISCONNECT BOT
                    </>
                ) : (
                    <>
                        <MessageSquare className="w-4 h-4" />
                        LINK WHATSAPP BOT
                    </>
                )}
            </button>

            {/* QR Modal */}
            {showQRModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">Scan QR Code with WhatsApp</h2>
                            <button
                                onClick={() => {
                                    setShowQRModal(false);
                                    cancelConnection();
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="text-center">
                            <div className="mb-6">
                                {qrImageSrc ? (
                                    <img 
                                        src={qrImageSrc} 
                                        alt="QR Code" 
                                        className="mx-auto border-2 border-gray-200 rounded-lg p-2 max-w-[250px]"
                                    />
                                ) : (
                                    <div className="mx-auto border-2 border-gray-200 rounded-lg p-8 max-w-[250px] flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 text-sm">
                                <p className="font-bold text-gray-700 mb-2">TO SCAN:</p>
                                <ol className="text-left text-gray-600 space-y-1">
                                    <li>1. Open WHATSAPP on your phone</li>
                                    <li>2. Go to SETTINGS → LINKED DEVICES</li>
                                    <li>3. Tap "LINK A DEVICE"</li>
                                    <li>4. Scan this QR code</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default WhatsAppBotController;