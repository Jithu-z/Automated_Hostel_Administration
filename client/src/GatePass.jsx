import { useState, useEffect } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode'; 
import { DoorOpen, MapPin, AlertCircle } from 'lucide-react';

function GatePass() {
  const studentId = 2; // Hardcoded 
  const [status, setStatus] = useState('in'); 
  
  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false); 

  // Form Data
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Fetch Status on Load
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = () => {
    axios.get(`http://localhost:3001/api/gate/status/${studentId}`)
      .then(res => setStatus(res.data.status))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      // Cleanup when closing modal
      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [showScanner]);

  // 3. Handle Successful Scan
  const onScanSuccess = async (decodedText) => {
    // In real app, we verify the specific code. For now, accept anything.
    console.log(`Scan result: ${decodedText}`);
    
    // Stop the scanner immediately
    setShowScanner(false);
    
    // Call the API
    performCheckIn(decodedText);
  };

  const onScanFailure = (error) => {
    // console.warn(error); // Ignore frame failures
  };

  // 4. API Calls
  const performCheckIn = async (qrData) => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3001/api/gate/log', {
        student_id: studentId,
        action: 'in',
        reason: 'Returned via Scan',
        destination: 'Hostel',
        qr_code: qrData 
      });

      if (res.data.success) {
        setStatus('in');
        alert("Verified! Welcome back.");
      }
    } catch (err) {
      if (err.response && err.response.status === 403) {
         alert("Security Alert: Invalid QR Code!");
      } else if (err.response) {
         console.error("Server Error:", err.response.data);
         alert(`System Error: ${JSON.stringify(err.response.data)}`);
      } else {
         console.error(err);
         alert("Network Error");
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmCheckOut = async () => {
    if (!destination.trim() || !reason.trim()) {
      alert("⚠️ Please fill in both Destination and Reason.");
      return; // Stop here! Do not send to server.
    }
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:3001/api/gate/log', {
        student_id: studentId,
        action: 'out',
        destination: destination,
        reason: reason
      });
      if (res.data.success) {
        setStatus('out');
        setShowCheckoutModal(false);
        setDestination('');
        setReason('');
      }
    } catch (err) {
      alert("Error processing request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in relative pb-20">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Digital Gatepass</h2>
        <p className="text-gray-500 text-sm">Manage your hostel entry and exit</p>
      </div>

      {/* Main Status Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-500 mb-3">Current Status</p>
        
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-3 h-3 rounded-full ${status === 'in' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
          <span className={`text-lg font-bold ${status === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
            {status === 'in' ? 'Checked In' : 'Checked Out'}
          </span>
        </div>

        {status === 'in' ? (
          <button 
            onClick={() => setShowCheckoutModal(true)}
            className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200 active:scale-95 transition"
          >
            Check Out
          </button>
        ) : (
          <button 
            onClick={() => setShowScanner(true)}
            className="w-full py-4 rounded-xl font-bold text-white bg-green-600 shadow-lg shadow-green-200 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <DoorOpen size={20} /> Scan QR to Check In
          </button>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Recent Activity</h3>
        <div className="flex items-start gap-3 pb-4 border-b border-gray-50 opacity-60">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><AlertCircle size={16}/></div>
            <div>
                <p className="text-sm font-bold text-gray-800">Checked Out</p>
                <p className="text-xs text-gray-500">Log entry recorded</p>
            </div>
        </div>
      </div>

      {/* --- CHECKOUT MODAL --- */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 animate-slide-up">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Check Out</h3>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase">Destination</label>
                <div className="flex items-center bg-gray-50 rounded-xl mt-1 p-3 border border-gray-100">
                  <MapPin size={18} className="text-gray-400 mr-2"/>
                  <input 
                    className="bg-transparent w-full outline-none text-sm" 
                    placeholder="Where are you going?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase">Reason</label>
                <textarea 
                  className="w-full bg-gray-50 rounded-xl mt-1 p-3 border border-gray-100 outline-none text-sm h-20 resize-none" 
                  value={reason}
                  placeholder='enter reason'
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100">Cancel</button>
              <button onClick={confirmCheckOut} disabled={loading} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 shadow-md">
                {loading ? '...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SCANNER MODAL --- */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-[60] flex flex-col items-center justify-center">
          <div className="w-full max-w-sm p-4">
            <h3 className="text-white text-center font-bold mb-4">Align QR Code</h3>
            {/* The ID 'reader' is where the camera renders */}
            <div id="reader" className="bg-white rounded-xl overflow-hidden shadow-2xl"></div>
            <button 
              onClick={() => setShowScanner(false)}
              className="mt-8 w-full py-3 bg-red-600 text-white font-bold rounded-xl"
            >
              Close Camera
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default GatePass;