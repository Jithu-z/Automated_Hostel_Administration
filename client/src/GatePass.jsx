import { useState, useEffect } from 'react';
import axios from 'axios';
import { DoorOpen, MapPin, AlertCircle, CheckCircle } from 'lucide-react';

function GatePass() {
  // Get user from local storage (or pass via props)
  // For Day 2, we assume user ID is 2 (the student we seeded). 
  // Ideally, pass this from AppLayout props.
  const studentId = 2; 

  const [status, setStatus] = useState('in'); // 'in' (Green) or 'out' (Orange)
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Fetch Status on Load
  useEffect(() => {
    axios.get(`http://localhost:3001/api/gate/status/${studentId}`)
      .then(res => setStatus(res.data.status))
      .catch(err => console.error(err));
  }, []);

  // 2. Handle Check OUT (Opens Modal)
  const handleCheckOutClick = () => {
    setShowModal(true);
  };

  // 3. Submit the Check OUT Request
  const confirmCheckOut = async () => {
    if (!destination || !reason) return alert("Please fill details");
    
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
        setShowModal(false);
        setDestination('');
        setReason('');
      }
    } catch (err) {
      alert("Error processing request");
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Check IN (For now, just a button. Later this will be the Scanner)
  const handleCheckIn = async () => {
    const confirm = window.confirm("Are you at the Gate? (Simulating QR Scan)");
    if (!confirm) return;

    try {
      const res = await axios.post('http://localhost:3001/api/gate/log', {
        student_id: studentId,
        action: 'in',
        reason: 'Returned'
      });
      if (res.data.success) setStatus('in');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in relative">
      
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
            onClick={handleCheckOutClick}
            className="w-full py-4 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-200 active:scale-95 transition"
          >
            Check Out
          </button>
        ) : (
          <button 
            onClick={handleCheckIn}
            className="w-full py-4 rounded-xl font-bold text-white bg-green-600 shadow-lg shadow-green-200 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <DoorOpen size={20} /> Scan QR to Check In
          </button>
        )}
      </div>

      {/* Recent Activity (Static for Day 2) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Recent Activity</h3>
        <div className="flex items-start gap-3 pb-4 border-b border-gray-50 opacity-60">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><AlertCircle size={16}/></div>
            <div>
                <p className="text-sm font-bold text-gray-800">Checked Out</p>
                <p className="text-xs text-gray-500">Today, 10:00 AM</p>
                <p className="text-xs text-gray-500 mt-1">Reason: HOME</p>
            </div>
        </div>
      </div>

      {/* --- MODAL (The Popup) --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 animate-slide-up">
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">Check Out</h3>
            <p className="text-gray-500 text-sm mb-6">Please provide details about your departure.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase">Where are you going?</label>
                <div className="flex items-center bg-gray-50 rounded-xl mt-1 p-3 border border-gray-100">
                  <MapPin size={18} className="text-gray-400 mr-2"/>
                  <input 
                    className="bg-transparent w-full outline-none text-sm font-medium" 
                    placeholder="e.g. Town, Home"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 uppercase">Reason</label>
                <textarea 
                  className="w-full bg-gray-50 rounded-xl mt-1 p-3 border border-gray-100 outline-none text-sm font-medium h-24 resize-none" 
                  placeholder="e.g. Buying groceries, Going home for weekend..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={confirmCheckOut}
                disabled={loading}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default GatePass;