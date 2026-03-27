class WhatsAppBotController {
    constructor() {
        this.isConnected = false;
        this.isConnecting = false;
        this.qrRefreshInterval = null;
        
        this.initializeElements();
        this.bindEvents();
        this.checkConnectionStatus();
    }

    initializeElements() {
        this.button = document.getElementById('whatsappButton');
        this.qrModal = document.getElementById('qrModal');
        this.qrImage = document.getElementById('qrImage');
        this.closeQRBtn = document.getElementById('closeQR');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
    }

    bindEvents() {
        this.button.addEventListener('click', () => this.handleButtonClick());
        this.closeQRBtn.addEventListener('click', () => this.closeQRModal());
        
        // Close modal when clicking outside
        this.qrModal.addEventListener('click', (e) => {
            if (e.target === this.qrModal) {
                this.closeQRModal();
            }
        });

        // Listen for connection status updates
        this.startStatusPolling();
    }

    async handleButtonClick() {
        if (this.isConnected) {
            await this.disconnectBot();
        } else if (this.isConnecting) {
            this.cancelConnection();
        } else {
            await this.connectBot();
        }
    }

    async connectBot() {
        try {
            this.setConnectingState();
            
            // Request WhatsApp initialization
            const response = await fetch('/api/whatsapp/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to start WhatsApp initialization');
            }
            
            // Start QR code monitoring
            this.startQRMonitoring();
            
            // Show QR modal
            this.showQRModal();
            
            // Request QR code from server
            await this.requestQRCode();
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.setDisconnectedState();
            this.closeQRModal();
            this.showNotification('Failed to connect. Please try again.', 'error');
        }
    }

    async disconnectBot() {
    try {
        this.button.disabled = true;
        this.button.innerHTML = '<span class="loading"></span>DISCONNECTING...';

        const response = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
        const result = await response.json();

        if (response.ok) {
            // 1. DO NOT call setDisconnectedState yet (this keeps the button Red and at the bottom)
            
            if (result.success) {
                
                // 3. Wait 1 second for the layout to settle before resetting the button
                setTimeout(() => {
                    this.setDisconnectedState();
                    this.button.disabled = false;
                }, 1000);
            }
        }
    } catch (error) {
        console.error('Disconnect error:', error);
        this.setDisconnectedState();
    }
}

    cancelConnection() {
        this.stopQRMonitoring();
        this.setDisconnectedState();
        this.closeQRModal();
    }

    async requestQRCode() {
        try {
            console.log('Requesting QR code from server...');
            const response = await fetch('/api/whatsapp/qr');
            
            console.log('QR response status:', response.status);
            
            if (response.ok) {
                console.log('QR response OK, getting blob...');
                const blob = await response.blob();
                
                const imageUrl = URL.createObjectURL(blob);
                console.log('QR image URL created:', imageUrl);
                
                this.qrImage.src = imageUrl;
                
            } else {
                console.log('QR response failed:', response.statusText);
                const errorData = await response.json();
                console.log('Error data:', errorData);
                throw new Error(errorData.error || 'Failed to get QR code');
            }
            
        } catch (error) {
            console.error('QR request error:', error);
            throw error;
        }
    }

    startQRMonitoring() {
        // Use server-sent events for real-time updates
        this.eventSource = new EventSource('/api/whatsapp/events');
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Event received:', data);
                
                if (data.type === 'connected' || (data.connected && data.state === 'CONNECTED')) {
                    console.log('Connection detected via events, closing modal');
                    this.setConnectedState();
                    this.closeQRModal();
                    this.stopQRMonitoring();
                    this.showNotification('WhatsApp bot connected successfully!', 'success');
                }
            } catch (error) {
                console.error('Event parsing error:', error);
            }
        };
        
        this.eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            // Fallback to polling if events fail
            this.startFallbackPolling();
        };
    }

    startFallbackPolling() {
        console.log('Fallback to polling for connection status');
        this.qrRefreshInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/whatsapp/status');
                const data = await response.json();
                
                console.log('Fallback polling - Status check:', data);
                
                if (data.connected) {
                    console.log('Fallback polling - Connection detected, closing modal');
                    this.setConnectedState();
                    this.closeQRModal();
                    this.stopQRMonitoring();
                    this.showNotification('WhatsApp bot connected successfully!', 'success');
                }
            } catch (error) {
                console.error('Fallback polling - Status check error:', error);
            }
        }, 1000);
    }

    stopQRMonitoring() {
        if (this.qrRefreshInterval) {
            clearInterval(this.qrRefreshInterval);
            this.qrRefreshInterval = null;
        }
        
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    showQRModal() {
        this.qrModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeQRModal() {
        this.qrModal.classList.remove('show');
        document.body.style.overflow = 'auto';
        this.stopQRMonitoring();
        this.setDisconnectedState();
    }

    setConnectedState() {
        this.isConnected = true;
        this.isConnecting = false;
        this.button.textContent = 'DISCONNECT BOT';
        this.button.classList.add('disconnect');
        this.button.disabled = false;
        this.updateStatus('Connected', 'connected');
    }

    setConnectingState() {
        this.isConnected = false;
        this.isConnecting = true;
        this.button.innerHTML = '<span class="loading"></span>CONNECTING...';
        this.button.classList.remove('disconnect');
        this.button.disabled = false;
        this.updateStatus('Connecting...', 'connecting');
    }

    setDisconnectedState() {
        this.isConnected = false;
        this.isConnecting = false;
        this.button.textContent = 'LINK WHATSAPP BOT';
        this.button.classList.remove('disconnect');
        this.button.disabled = false;
        this.updateStatus('Disconnected', 'disconnected');
    }

    updateStatus(text, state) {
        this.statusText.textContent = text;
        this.statusDot.className = `status-dot ${state}`;
    }

    async checkConnectionStatus() {
        try {
            const response = await fetch('/api/whatsapp/status');
            const data = await response.json();
            
            console.log('Status check:', data); // Debug log
            
            // Use the enhanced connected status from server
            if (data.connected) {
                this.setConnectedState();
            } else {
                this.setDisconnectedState();
            }
        } catch (error) {
            console.error('Status check error:', error);
            this.setDisconnectedState();
        }
    }

    startStatusPolling() {
        // Check status every 5 seconds
        setInterval(() => {
            this.checkConnectionStatus();
        }, 5000);
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '25px',
            color: 'white',
            fontWeight: '500',
            zIndex: '2000',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });

        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#007bff'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);

        // Hide and remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhatsAppBotController();
});
