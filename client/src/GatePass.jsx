import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Html5QrcodeScanner } from 'html5-qrcode'; 
import { DoorOpen, MapPin, AlertCircle, LogOut, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = 'http://192.168.1.11:3001/api'; 

function GatePass() {
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const studentId = storedUser ? storedUser.uid : null;
  const [status, setStatus] = useState('in'); 
  const [logs, setLogs] = useState([]); 
  
  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false); 

  // Form Data
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (studentId) {
      fetchStatus();
      fetchLogs();
    }
  }, [studentId]);

  const fetchStatus = () => {
    axios.get(`${API_BASE}/gate/status/${studentId}`)
      .then(res => setStatus(res.data.status))
      .catch(err => console.error(err));
  };

  const fetchLogs = () => {
    axios.get(`${API_BASE}/student/logs/${studentId}`)
      .then(res => setLogs(res.data))
      .catch(err => console.error("Failed to fetch logs", err));
  };

  // QR Scanner Initialization
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader", 
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [showScanner]);

  const onScanSuccess = async (decodedText) => {
    setShowScanner(false);
    performCheckIn(decodedText);
  };

  const onScanFailure = (error) => {
    // Ignore frame failures silently
  };

  const performCheckIn = async (qrData) => {
    setLoading(true);
    
    toast.promise(
      axios.post(`${API_BASE}/gate/log`, {
        student_id: studentId,
        action: 'in',
        reason: 'Returned via Scan',
        destination: 'Hostel',
        qr_code: qrData 
      }),
      {
        loading: 'Verifying QR Code...',
        success: (res) => {
          if (res.data.success) {
            setStatus('in');
            fetchLogs();
            return "Verified! Welcome back.";
          }
          throw new Error("Verification failed");
        },
        error: (err) => {
          if (err.response?.status === 403) return "Security Alert: Invalid QR Code!";
          return "System Error. Please try again.";
        }
      }
    ).finally(() => setLoading(false));
  };

  const confirmCheckOut = async () => {
    if (!destination.trim() || !reason.trim()) {
      toast.error("Please fill in both Destination and Reason.");
      return; 
    }
    setLoading(true);

    toast.promise(
      axios.post(`${API_BASE}/gate/log`, {
        student_id: studentId,
        action: 'out',
        destination: destination,
        reason: reason
      }),
      {
        loading: 'Processing Gatepass...',
        success: (res) => {
          if (res.data.success) {
            setStatus('out');
            fetchLogs();
            setShowCheckoutModal(false);
            setDestination('');
            setReason('');
            return "Checked Out Successfully!";
          }
          throw new Error("Failed to checkout");
        },
        error: "Error processing request. Check network."
      }
    ).finally(() => setLoading(false));
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
        <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Current Status</p>
        
        <div className="flex items-center gap-2 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <span className={`w-3 h-3 rounded-full animate-pulse ${status === 'in' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]'}`}></span>
          <span className={`text-xl font-black ${status === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
            {status === 'in' ? 'Checked in' : 'Checked Out'}
          </span>
        </div>

        {status === 'in' ? (
          <button 
            onClick={() => setShowCheckoutModal(true)}
            className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Check Out
          </button>
        ) : (
          <button 
            onClick={() => setShowScanner(true)}
            className="w-full py-4 rounded-xl font-bold text-white bg-green-600 shadow-lg shadow-green-200 hover:bg-green-700 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <ScanLine size={20} /> Scan QR to Return
          </button>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Recent Activity</h3>
  
        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">No activity recorded yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <div className={`p-2.5 rounded-xl shrink-0 ${log.status === 'out' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                  {log.status === 'out' ? <LogOut size={18}/> : <DoorOpen size={18}/>}
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-bold text-gray-800 capitalize">
                      {log.status === 'out' ? 'Checked Out' : 'Returned'}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400">
                      {new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(log.exit_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  
                  {log.status === 'out' && (
                    <div className="mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <p className="text-[10px] text-gray-500 font-medium"><span className="font-bold text-gray-700">To:</span> {log.destination}</p>
                      {log.reason && <p className="text-[10px] text-gray-500 font-medium line-clamp-1"><span className="font-bold text-gray-700">Reason:</span> {log.reason}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- CHECKOUT MODAL --- */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white mb-20 sm:mb-0 w-full max-w-sm rounded-3xl p-6 animate-slide-up shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Check Out Form</h3>
            <p className="text-xs text-gray-500 mb-4">Please log your destination for safety.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Destination</label>
                <div className="flex items-center bg-gray-50 rounded-xl mt-1 p-3 border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <MapPin size={18} className="text-gray-400 mr-2 shrink-0"/>
                  <input 
                    className="bg-transparent w-full outline-none text-sm font-medium text-gray-800" 
                    placeholder="Where are you going?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Reason</label>
                <textarea 
                  className="w-full bg-gray-50 rounded-xl mt-1 p-3 border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium text-gray-800 h-24 resize-none transition-all" 
                  value={reason}
                  placeholder='E.g., Visiting home, grocery shopping...'
                  onChange={(e) => setReason(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition">Cancel</button>
              <button onClick={confirmCheckOut} disabled={loading} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 shadow-md hover:bg-blue-700 transition disabled:opacity-70">
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SCANNER MODAL --- */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center backdrop-blur-md">
          <div className="w-full max-w-sm p-6 flex flex-col items-center">
            <ScanLine size={48} className="text-green-400 mb-4 animate-pulse" />
            <h3 className="text-white text-xl font-bold mb-2">Scan Kiosk QR</h3>
            <p className="text-gray-400 text-sm text-center mb-8">Point your camera at the QR code displayed at the security desk to check in.</p>
            
            <div id="reader" className="w-full bg-white rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(74,222,128,0.2)]"></div>
            
            <button 
              onClick={() => setShowScanner(false)}
              className="mt-8 w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default GatePass;