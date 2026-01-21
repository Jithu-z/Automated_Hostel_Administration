import { useState } from 'react';

function GatePass() {
  const [status, setStatus] = useState('in'); // 'in' or 'out'

  // Dummy Handler for Day 1
  const handleToggle = () => {
    if (status === 'in') {
        const confirm = window.confirm("Fake Modal: Where are you going?");
        if(confirm) setStatus('out');
    } else {
        setStatus('in');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Digital Gatepass</h2>
        <p className="text-gray-500 text-sm">Manage your hostel entry and exit</p>
      </div>

      {/* Status Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-500 mb-3">Current Status</p>
        
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-3 h-3 rounded-full ${status === 'in' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
          <span className={`text-lg font-bold ${status === 'in' ? 'text-green-600' : 'text-orange-600'}`}>
            {status === 'in' ? 'Checked In' : 'Checked Out'}
          </span>
        </div>

        <button 
          onClick={handleToggle}
          className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2
            ${status === 'in' ? 'bg-blue-600 shadow-blue-200' : 'bg-green-600 shadow-green-200'}`}
        >
          {status === 'in' ? 'Check Out' : 'Scan QR Code to Check In'}
        </button>
      </div>

      {/* Recent Activity (Placeholder) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 opacity-60">
        <h3 className="text-sm font-bold text-gray-800 mb-4">Recent Activity</h3>
        <div className="flex items-start gap-3 pb-4 border-b border-gray-50">
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600 text-xs font-bold">OUT</div>
            <div>
                <p className="text-sm font-bold text-gray-800">Checked Out</p>
                <p className="text-xs text-gray-500">8/1/2026, 2:01 AM</p>
                <p className="text-xs text-gray-500 mt-1">Reason: HOME</p>
            </div>
        </div>
      </div>
    </div>
  );
}

export default GatePass;