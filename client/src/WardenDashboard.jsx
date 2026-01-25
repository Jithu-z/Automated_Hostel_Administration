import { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

function WardenDashboard() {
  const [stats, setStats] = useState({ out_now: 0, total_students: 0 });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const handleReset = async () => {
    if (!window.confirm("⚠️ ARE YOU SURE? This will delete ALL logs and mark everyone as Present.")) {
      return;
    }

    try {
      await axios.post('http://localhost:3001/api/warden/reset');
      alert("System Reset Successfully!");
      fetchData(); // Refresh the table immediately
    } catch (err) {
      alert("Failed to reset system");
    }
  };
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3001/api/warden/dashboard');
      setStats(res.data.stats);
      setLogs(res.data.recent_logs);
    } catch (err) {
      console.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Optional: Auto-refresh every 5 seconds to make it look "Live"
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen animate-fade-in">
      
      {/* Header */}
      {/* Replace your Header section with this: */}
  <div className="flex justify-between items-center mb-8">
    <div>
     <h1 className="text-3xl font-bold text-gray-800">Warden Dashboard</h1>
      <p className="text-gray-500">Live monitoring of hostel movements</p>
    </div>
  
  <div className="flex gap-3">
    {/* NEW: Reset Button */}
      <button 
        onClick={handleReset}
        className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition text-sm"
      >
        Reset System
      </button>

    {/* Existing Refresh Button */}
      <button onClick={fetchData} className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition">
        <RefreshCw size={20} className={`text-blue-600 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Card 1: Students OUT */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-orange-100 rounded-xl text-orange-600">
            <AlertTriangle size={32} />
          </div>
          <div>
            <p className="text-gray-500 font-bold text-sm uppercase">Students Out</p>
            <h2 className="text-4xl font-bold text-gray-800">{stats.out_now}</h2>
          </div>
        </div>

        {/* Card 2: Total Strength */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-xl text-blue-600">
            <Users size={32} />
          </div>
          <div>
            <p className="text-gray-500 font-bold text-sm uppercase">Total Strength</p>
            <h2 className="text-4xl font-bold text-gray-800">{stats.total_students}</h2>
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h3 className="text-lg font-bold text-gray-800">Recent Movements</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Destination/Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-800">{log.name}</p>
                    <p className="text-xs text-gray-500">{log.uid}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      log.status === 'returned' || log.status === 'in' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {log.status === 'returned' ? 'RETURNED' : 'OUT'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      {new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(log.exit_time).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-800">{log.destination || 'N/A'}</p>
                    <p className="text-xs text-gray-500 truncate max-w-[150px]">{log.reason}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="p-8 text-center text-gray-400">No logs found yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WardenDashboard;