import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  Home,Star,Clock,RefreshCw,Trash2,Search, CheckCircle, ClipboardList, Utensils, Moon, AlertCircle, Users, Settings, LogOut, 
  Filter, ListFilter, X, FileVideo, Phone, Calendar, Shield, Edit2, Save, ChevronRight,TrendingDown, AlertOctagon, MessageSquare, Plus, Sparkles, BrainCircuit, Image as ImageIcon,
  TrendingUp, ThumbsUp, ThumbsDown, Zap, Upload, AlertTriangle, ChevronDown, UserCheck, GraduationCap, Download, HelpCircle, Info, Database,
  Scale, UtensilsCrossed, Smile, Leaf
} from 'lucide-react';
import toast from 'react-hot-toast';
const SERVER_URL = 'http://localhost:3001';
const API_BASE = `${SERVER_URL}/api`;
// --- SUB-COMPONENTS  ---

const OvernightLogTab = () => {
  const [stats, setStats] = useState({ out_now: 0, total_students: 50 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [outStudents, setOutStudents] = useState([]);

  const [showOutModal, setShowOutModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [absentSearch, setAbsentSearch] = useState('');
  const [gateSearch, setGateSearch] = useState('');
  const [gateFilter, setGateFilter] = useState('All');
  const [gateDate, setGateDate] = useState(''); // Empty string means "All Time"

  const [isLocked, setIsLocked] = useState(false);

  // Initial Data Fetch (Only for Home Tab)
  useEffect(() => {
    fetchOvernightLogData();
    const interval = setInterval(fetchOvernightLogData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOvernightLogData = () => {
    setLoading(true);
    axios.get('http://localhost:3001/api/warden/overnightlog') 
      .then(res => {
        setStats(res.data.stats);
        setRecentLogs(res.data.recent_logs);
      })
      .catch(err => console.error("Dashboard fetch error", err)) 
      .finally(() => setLoading(false));
  };

  const executeCheckin = async (uid) => {
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:3001/api/warden/checkinOverride", {
        student_id: uid,
        action: 'returned',
        reason: 'Returned via Overridden check-in',
        destination: 'Hostel',
      });
      
      if (res.data.success) {
          setOutStudents(prev => prev.filter(student => student.uid !== uid));
          fetchOvernightLogData();
          toast.success(`Student forcefully checked in!`); 
      }
    } catch (err) {
      console.error("Server Error:", err.response?.data);
      toast.error(err.response?.data?.error || "System Error during check-in"); 
    } finally {
      setLoading(false);
    }
  }

  const handleOutClick = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/warden/out-list');
      setOutStudents(res.data);
      setShowOutModal(true);
    } catch (err) {
      toast.error("Failed to fetch student data."); 
    }
  };
  
  // --- FACTORY RESET LOGIC ---
  const executeReset = async () => {
    toast.promise(
      axios.post('http://localhost:3001/api/warden/reset'),
      {
        loading: 'Wiping system logs...',
        success: 'System Reset Successfully!',
        error: 'Failed to reset system.',
      }
    ).then(() => fetchOvernightLogData());
  };

  const handleReset = () => {
    setIsLocked(true);
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-start gap-2 text-red-600">
          <AlertTriangle size={24} className="shrink-0" />
          <div>
            <p className="font-bold text-sm">Factory Reset System?</p>
            <p className="text-sm text-gray-500 mt-1">
              This will permanently delete ALL exit logs and mark every student as Present. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button 
            onClick={() => { toast.dismiss(t.id); setIsLocked(false); }} 
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button 
            onClick={() => { toast.dismiss(t.id); executeReset(); setIsLocked(false); }} 
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-sm"
          >
            Wipe Everything
          </button>
        </div>
      </div>
    ), { id: 'factory-reset', duration: Infinity });
  };

  // 2. The Custom Confirmation UI
  const checkinOverride = (uid) => {
    setIsLocked(true);
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[250px]">
        <div className="flex items-center gap-2 text-gray-800">
          <AlertTriangle size={18} className="text-orange-500" />
          <p className="font-bold text-sm">Force check-in for {uid}?</p>
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <button
            onClick={() => {toast.dismiss(t.id);setIsLocked(false);}}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id); 
              executeCheckin(uid);
              setIsLocked(false); 
            }}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    ), { 
      duration: Infinity, // Keeps it open until button click
      id: `confirm-${uid}` // Prevents spam-clicking and opening 5 popups
    });
  }

  // FILTER OUT STUDENTS
  const filteredOutStudents = outStudents.filter(s => {
      const term = absentSearch.toLowerCase();
      return (
        (s.full_name || '').toLowerCase().includes(term) || 
        (s.uid || '').toLowerCase().includes(term) ||
        (s.room_no || '').toLowerCase().includes(term) ||
        (s.branch || '').toLowerCase().includes(term) || 
        (s.batch || '').toLowerCase().includes(term)     
      );
  });

  // FILTER GATE LOGS 
  const filteredRecentLogs = recentLogs.filter(log => {
      const term = gateSearch.toLowerCase();
      const matchText = (log.full_name || '').toLowerCase().includes(term) || 
                        (log.uid || '').toLowerCase().includes(term) ||
                        (log.room_no || '').toLowerCase().includes(term) || 
                        (log.branch || '').toLowerCase().includes(term) ||  
                        (log.batch || '').toLowerCase().includes(term);     
                        
      const matchFilter = gateFilter === 'All' 
        ? true 
        : (gateFilter === 'Checked Out' ? log.status === 'out' : log.status === 'returned');
      
      const logDateString = new Date(log.exit_time).toISOString().split('T')[0];
      const matchDate = gateDate === '' ? true : logDateString === gateDate;

      return matchText && matchFilter && matchDate;
  });

  return (
    <div className="animate-fade-in">
      {isLocked && (
        <div className="fixed inset-0 z-[40] bg-black/10 backdrop-blur-[2px] cursor-not-allowed" />
      )}
      
      {/* --- HEADER & GLOBAL ACTIONS --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Overnight Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor live campus exits and entries.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleReset}
            className="flex-1 md:flex-none px-4 py-2.5 bg-red-50 text-red-600 font-bold border border-red-200 rounded-xl hover:bg-red-100 hover:border-red-300 transition text-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <AlertTriangle size={16} /> Factory Reset
          </button>
          <button 
            onClick={fetchOvernightLogData} 
            className="p-2.5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={`text-blue-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        
        {/* Students Out Card (Clickable) */}
        <div 
          onClick={handleOutClick} 
          className="bg-red-50 p-6 rounded-2xl border border-red-100 cursor-pointer hover:shadow-md hover:border-red-300 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-bl-full opacity-50 -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1">Currently Out</p>
              <h3 className="text-4xl font-black text-red-700">{stats.out_now}</h3>
            </div>
            <div className="p-3 bg-red-200/50 rounded-xl text-red-600"><LogOut size={24}/></div>
          </div>
          <div className="mt-4 flex items-center text-sm font-bold text-red-600 gap-1 group-hover:translate-x-1 transition-transform">
            View Absent List <span>&rarr;</span>
          </div>
        </div>

        {/* Total Students Card */}
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-bl-full opacity-50 -z-10"></div>
          <div className="flex justify-between items-start z-10">
            <div>
              <p className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-1">Total Residents</p>
              <h3 className="text-4xl font-black text-blue-700">{stats.total_students}</h3>
            </div>
            <div className="p-3 bg-blue-200/50 rounded-xl text-blue-600"><Users size={24}/></div>
          </div>
          <div className="mt-4 flex items-center text-sm font-bold text-blue-500 gap-1">
            On Registry
          </div>
        </div>
      </div>

      {/* --- RECENT LOGS TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            Recent Gate Activity
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search log..." 
                    value={gateSearch}
                    onChange={(e) => setGateSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
                />
            </div>

            {/*Date Picker*/}
            <div className={`flex items-center w-full sm:w-auto pr-2 border rounded-lg transition shadow-sm ${
              gateDate ? 'border-blue-400 bg-blue-50' : 'bg-white border-gray-200'
            }`}>
                <input 
                    type="date" 
                    value={gateDate}
                    onChange={(e) => setGateDate(e.target.value)}
                    className={`flex-1 pl-3 pr-1 py-2 bg-transparent text-sm font-medium outline-none w-full sm:w-40 ${
                      gateDate ? 'text-blue-700' : 'text-gray-700'
                    }`}
                    title="Filter by Date"
                />
                
                {/* Clear Date Button */}
                {gateDate && (
                  <button 
                    onClick={() => setGateDate('')}
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-blue-400 hover:text-red-600 hover:bg-red-100 transition-colors text-sm font-bold ml-1"
                    title="Clear Date Filter"
                  >
                    ✕
                  </button>
                )}
            </div>

            {/* Status Filter */}
            <div className="relative w-full sm:w-auto">
                <Filter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select 
                    value={gateFilter}
                    onChange={(e) => setGateFilter(e.target.value)}
                    className="w-full sm:w-auto pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-sm"
                >
                    <option value="All">All Statuses</option>
                    <option value="Checked In">Returned</option>
                    <option value="Checked Out">Checked-Out</option>
                </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-sm font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Destination & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecentLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-400 bg-gray-50/50">
                    <div className="flex flex-col items-center gap-2">
                      <Filter size={32} className="text-gray-300" />
                      <p>No log records found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{log.full_name || "Unknown"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500 font-medium">{log.uid}</span>
                        {log.room_no && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              🚪 {log.room_no}
                            </span>
                            <span className="text-xs text-gray-500 font-medium hidden md:inline-block">
                              {log.branch} ({log.batch})
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                        log.status === 'out' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-green-100 text-green-700 border border-green-200'
                      }`}>
                        {log.status === 'out' ? 'Checked Out' : 'Returned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm font-bold text-gray-700">
                          <Clock size={14} className="text-gray-400" />
                          {new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-gray-400 mt-1 font-medium pl-5">
                          {new Date(log.exit_time).toLocaleDateString()}
                        </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-sm font-bold text-gray-800 truncate">{log.destination || 'N/A'}</p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">{log.reason}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- STUDENTS OUT MODAL --- */}
      {showOutModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
              <div>
                <h3 className="font-black text-xl flex items-center gap-2">
                  <AlertTriangle size={20} /> Active Absences
                </h3>
                <p className="text-red-200 text-sm mt-1">Students currently off-campus</p>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search by Name, Room, UID or branch..." 
                        value={absentSearch}
                        onChange={(e) => setAbsentSearch(e.target.value)}
                        className="text-black w-full pl-9 pr-4 py-2 bg-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-300 transition shadow-sm"
                    />
                </div>
                <button 
                  onClick={() => {setShowOutModal(false); setAbsentSearch('');}} 
                  className="hover:bg-red-800 p-2 rounded-lg transition-colors bg-red-700/50 shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-0 bg-gray-50">
              {filteredOutStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <div className="bg-green-100 text-green-600 p-4 rounded-full mb-3"><Users size={32}/></div>
                  <p className="font-bold text-gray-600">No Data</p>
                  <p className="text-sm mt-1">No student info found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 shadow-sm z-10">
                    <tr className="border-b border-gray-200 text-sm font-bold text-gray-400 uppercase tracking-wider">
                      <th className="p-4 pl-6">Student Details</th>
                      <th className="p-4">Room No.</th>
                      <th className="p-4">Phone No.</th>
                      <th className="p-4">Home Address</th>
                      <th className="p-4 pr-6 text-right">Emergency Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredOutStudents.map((student) => (
                      <tr key={student.uid} className="hover:bg-red-50/30 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-gray-800">{student.full_name}</p>
                          <div className="flex flex-col items-start gap-1.5 mt-0.5">
                            <p className="text-sm text-gray-500 font-medium">{student.uid}</p>
                            {/* ✨ NEW: Academic Badge */}
                            {student.branch && (
                              <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                                🎓 {student.branch} • {student.batch}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* POLISHED ROOM NUMBER BADGE */}
                        <td className="p-4">
                          {student.room_no ? (
                            <span className="bg-gray-100 text-gray-700 font-bold px-2.5 py-1 rounded-md text-sm border border-gray-200 whitespace-nowrap">
                              {student.room_no}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm italic">N/A</span>
                          )}
                        </td>

                        <td className="p-4 text-sm text-gray-600 font-medium whitespace-nowrap">{student.phone_no || 'N/A'}</td>
                        <td className="p-4 text-sm text-gray-500 max-w-xs truncate" title={student.address}>{student.address || 'N/A'}</td>
                        <td className="p-4 pr-6 text-right">
                          <button 
                            className="bg-green-50 hover:bg-green-600 text-green-700 hover:text-white border border-green-200 px-4 py-2 rounded-lg text-sm font-bold transition-all active:scale-95 whitespace-nowrap" 
                            onClick={() => checkinOverride(student.uid)}
                          >
                            Force Check-In
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const GrievancesTab = () => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('active'); 

  const [filterCategory, setFilterCategory] = useState('All'); 
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const [evidenceModal, setEvidenceModal] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    fetchGrievances();
    const interval = setInterval(fetchGrievances, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchGrievances = () => {
    setLoading(true);
    axios.get(`${API_BASE}/warden/grievances`)
      .then(res => setGrievances(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  // 1. STATUS UPDATE LOGIC
  const executeStatusUpdate = async (id, newStatus) => {
    try {
      await axios.put(`${API_BASE}/warden/grievances/${id}`, { status: newStatus });
      if (newStatus === 'Resolved') {
        toast.success("Issue resolved & evidence deleted.");
        fetchGrievances(); 
      } else {
        setGrievances(grievances.map(g => g.id === id ? { ...g, status: newStatus } : g));
        toast.success(`Status updated to ${newStatus}`);
      }
    } catch (err) {
      toast.error("Failed to update status");
      fetchGrievances(); 
    }
  };

  const handleStatusUpdate = (id, newStatus) => {
    if (newStatus === 'Resolved') {
      toast((t) => (
        <div className="flex flex-col gap-3 min-w-[250px]">
          <div className="flex items-center gap-2 text-gray-800">
            <CheckCircle size={18} className="text-green-500" />
            <p className="font-bold text-sm">Mark as Resolved?</p>
          </div>
          <p className="text-sm text-gray-500">This moves it to history and deletes the evidence file.</p>
          <div className="flex gap-2 justify-end mt-1">
            <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">Cancel</button>
            <button 
              onClick={() => { toast.dismiss(t.id); executeStatusUpdate(id, newStatus);}}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      ), { id: `resolve-${id}`, duration: Infinity });
    } else {
      executeStatusUpdate(id, newStatus);
    }
  };

  // 2. DELETE SINGLE RECORD LOGIC
  const executeDelete = async (id) => {
    toast.promise(
      axios.delete(`${API_BASE}/warden/grievances/${id}`),
      {
        loading: 'Deleting record...',
        success: 'Record permanently deleted',
        error: 'Failed to delete record'
      }
    ).then(() => setGrievances(grievances.filter(g => g.id !== id)));
  };

  const handleDelete = (id) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[250px]">
        <div className="flex items-center gap-2 text-red-600">
          <Trash2 size={18} />
          <p className="font-bold text-sm">Delete this record?</p>
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { toast.dismiss(t.id); executeDelete(id); }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition">Delete</button>
        </div>
      </div>
    ), { id: `delete-${id}`, duration: Infinity });
  };

  // 3. CLEAR ALL HISTORY LOGIC
  const executeClearHistory = async () => {
    toast.promise(
      axios.delete(`${API_BASE}/warden/grievances/clear-history`),
      {
        loading: 'Wiping history...',
        success: 'History cleared successfully',
        error: 'Failed to clear history'
      }
    ).then(() => setGrievances(grievances.filter(g => g.status !== 'Resolved')));
  };

  const handleClearHistory = () => {
    setIsLocked(true);
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-start gap-2 text-red-600">
          <AlertOctagon size={24} className="shrink-0" />
          <div>
            <p className="font-bold text-sm">Clear All History?</p>
            <p className="text-sm text-gray-500 mt-1">This permanently deletes all resolved complaints. It cannot be undone.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => {toast.dismiss(t.id);setIsLocked(false);}} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { toast.dismiss(t.id); executeClearHistory(); setIsLocked(false);}} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition">Wipe History</button>
        </div>
      </div>
    ), { id: 'clear-history', duration: Infinity });
  };

  // 4. RESOLVE ALL LOGIC
  const executeResolveAll = async (itemsToResolve) => {
    toast.promise(
      Promise.all(itemsToResolve.map(g => axios.put(`${API_BASE}/warden/grievances/${g.id}`, { status: 'Resolved' }))),
      {
        loading: `Resolving ${itemsToResolve.length} complaints...`,
        success: `Successfully resolved ${itemsToResolve.length} complaints!`,
        error: 'Some requests failed. Please try again.'
      }
    ).then(() => fetchGrievances());
  };

  const handleResolveAll = () => {
    const itemsToResolve = filteredGrievances.filter(g => g.status !== 'Resolved');
    if (itemsToResolve.length === 0) return;
    setIsLocked(true);
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle size={20} />
          <p className="font-bold text-sm">Resolve {itemsToResolve.length} Complaints?</p>
        </div>
        <p className="text-sm text-gray-500">This will mark all visible complaints as Resolved and delete their attached evidence.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => {toast.dismiss(t.id);setIsLocked(false);}} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { toast.dismiss(t.id);setIsLocked(false);executeResolveAll(itemsToResolve); }} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition">Resolve All</button>
        </div>
      </div>
    ), { id: 'resolve-all', duration: Infinity });
  };

  // 5. ASSIGN ALL LOGIC
  const executeAssignAll = async (itemsToAssign) => {
    toast.promise(
      Promise.all(itemsToAssign.map(g => axios.put(`${API_BASE}/warden/grievances/${g.id}`, { status: 'Assigned' }))),
      {
        loading: `Assigning ${itemsToAssign.length} complaints...`,
        success: `Successfully assigned ${itemsToAssign.length} complaints!`,
        error: 'Some requests failed. Please try again.'
      }
    ).then(() => fetchGrievances());
  };

  const handleAssignAll = () => {
    const itemsToAssign = filteredGrievances.filter(g => g.status === 'Pending');
    if (itemsToAssign.length === 0) {
      toast.error("No pending complaints visible to assign.");
      return;
    }
    setIsLocked(true);
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-center gap-2 text-blue-600">
          <UserCheck size={20} />
          <p className="font-bold text-sm">Assign {itemsToAssign.length} Complaints?</p>
        </div>
        <p className="text-sm text-gray-500">This will mark all visible 'Pending' complaints as 'Assigned'.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => {toast.dismiss(t.id);setIsLocked(false);}} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { toast.dismiss(t.id); executeAssignAll(itemsToAssign);setIsLocked(false); }} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition">Assign All</button>
        </div>
      </div>
    ), { id: 'assign-all', duration: Infinity });
  };

  //  FILTERS 
  const filteredGrievances = grievances.filter(g => {
    const isResolved = g.status === 'Resolved';
    if (viewMode === 'active' && isResolved) return false;
    if (viewMode === 'history' && !isResolved) return false;
    if (viewMode === 'active' && filterStatus !== 'All') {
        if (g.status !== filterStatus) return false;
    }
    if (filterCategory !== 'All' && g.category !== filterCategory) return false;
    
    if (searchTerm !== '') {
        const lowerTerm = searchTerm.toLowerCase();
        const matchUid = (g.uid || '').toLowerCase().includes(lowerTerm);
        const matchName = (g.full_name || '').toLowerCase().includes(lowerTerm);
        const matchStudentRoom = (g.student_room || '').toLowerCase().includes(lowerTerm);
        const matchIssueLoc = (g.issue_location || '').toLowerCase().includes(lowerTerm);
        const matchBranch = (g.branch || '').toLowerCase().includes(lowerTerm);
        const matchBatch = (g.batch || '').toLowerCase().includes(lowerTerm);
        
        if (!matchUid && !matchName && !matchStudentRoom && !matchIssueLoc && !matchBranch && !matchBatch) return false;
    }
    return true;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Assigned': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Resolved': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  // --- EVIDENCE MODAL COMPONENT ---
  const EvidenceModal = () => {
    if (!evidenceModal) return null;
    const isVideo = evidenceModal.endsWith('.mp4') || evidenceModal.endsWith('.webm');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="relative bg-white rounded-2xl overflow-hidden max-w-4xl w-full shadow-2xl animate-slide-up">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700 flex items-center gap-2"><ImageIcon size={18}/> Evidence Review</h3>
            <button onClick={() => setEvidenceModal(null)} className="p-2 bg-white rounded-full hover:bg-gray-200 transition text-gray-500"><X size={20} /></button>
          </div>
          <div className="p-0 bg-black flex justify-center items-center min-h-[400px]">
            {isVideo ? (
              <video src={`${SERVER_URL}${evidenceModal}`} controls autoPlay className="max-h-[70vh] w-full" />
            ) : (
              <img src={`${SERVER_URL}${evidenceModal}`} alt="Evidence" className="max-h-[70vh] object-contain" />
            )}
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <p className="text-sm text-gray-500 font-medium">Original file hosted on local server</p>
            <a href={`${SERVER_URL}${evidenceModal}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
              Open Full Size &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <EvidenceModal />

      {isLocked && (
        <div className="fixed inset-0 z-[40] bg-black/10 backdrop-blur-[2px] cursor-not-allowed" />
      )}
      
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grievances</h1>
          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'active' ? 'Manage active campus complaints.' : 'Review resolved complaint history.'}
          </p>
        </div>
        
        {/* VIEW TOGGLE */}
        <div className="bg-gray-100 p-1 rounded-xl flex w-full lg:w-auto">
          <button 
            onClick={() => setViewMode('active')}
            className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'active' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Complaints
          </button>
          <button 
            onClick={() => setViewMode('history')}
            className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Resolved History
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Search UID, Name, Room, Location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm"
            />
          </div>
          
          {/* Category Filter */}
          <div className="relative w-full sm:w-auto">
            <Filter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full sm:w-auto pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-sm"
            >
              <option value="All">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Furniture">Furniture</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Status Filter */}
          {viewMode === 'active' && (
            <div className="relative w-full sm:w-auto">
              <ListFilter size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full sm:w-auto pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none shadow-sm"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
              </select>
            </div>
          )}
        </div>

        {/* BULK ACTIONS */}
        <div className="w-full md:w-auto flex flex-col sm:flex-row justify-end gap-2">
          {viewMode === 'active' && filteredGrievances.some(g => g.status === 'Pending') && (
            <button 
              onClick={handleAssignAll}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-100 active:scale-95 transition"
              title="Mark all visible pending complaints as Assigned"
            >
              <UserCheck size={16} /> 
              <span>Assign All ({filteredGrievances.filter(g => g.status === 'Pending').length})</span>
            </button>
          )}

          {viewMode === 'active' && filteredGrievances.length > 0 && (
            <button 
              onClick={handleResolveAll}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-green-700 active:scale-95 transition"
              title="Resolve all currently visible complaints"
            >
              <CheckCircle size={16} /> 
              <span>Resolve All ({filteredGrievances.length})</span>
            </button>
          )}

          {viewMode === 'history' && filteredGrievances.length > 0 && (
            <button 
              onClick={handleClearHistory}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 hover:border-red-300 transition active:scale-95"
            >
              <Trash2 size={16} /> Wipe History
            </button>
          )}
        </div>
      </div>

      {/* COMPLAINTS LIST */}
      <div className="space-y-4">
        {filteredGrievances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 rounded-2xl border border-gray-200 border-dashed">
             <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <CheckCircle size={32} className="text-green-500" />
             </div>
             <p className="text-gray-800 font-bold text-lg">Inbox Zero</p>
             <p className="text-gray-400 font-medium text-sm mt-1">No {viewMode} grievances match your filters.</p>
          </div>
        ) : (
          filteredGrievances.map((g) => (
            <div key={g.id} className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition group">
              
              {/* User Info Column */}
              <div className="flex gap-4 min-w-[240px]">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black text-xl border border-blue-100 shadow-sm shrink-0">
                  {g.full_name ? g.full_name.charAt(0).toUpperCase() : '?'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{g.full_name || "Unknown"}</h3>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">{g.uid}</p>
                  
                  <div className="mt-3 flex flex-col gap-1.5 items-start">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-bold border border-gray-200 shadow-sm">
                      🛏️ Room {g.student_room || 'Unassigned'}
                    </span>
                    {g.branch && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-bold border border-blue-100 shadow-sm uppercase tracking-wider">
                        🎓 {g.branch}
                      </span>
                    )}
                    {g.phone_no && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-1">
                        📞 {g.phone_no}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Complaint Content */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="text-sm px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md border border-gray-200 font-bold uppercase tracking-wider">
                          {g.category}
                      </span>
                      <span className="text-sm px-2.5 py-1 bg-red-50 text-red-600 rounded-md border border-red-100 font-bold uppercase tracking-wider flex items-center gap-1">
                          📍 {g.issue_location}
                      </span>
                    </div>
                    
                    {viewMode === 'active' ? (
                      <div className="relative shrink-0"> 
                        <select 
                          value={g.status}
                          onChange={(e) => handleStatusUpdate(g.id, e.target.value)}
                          className={`text-sm text-center pr-3 py-1.5 rounded-lg font-bold border outline-none cursor-pointer appearance-none shadow-sm ${getStatusColor(g.status)}`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Assigned">Assigned</option>
                          <option value="Resolved">✓ Mark Resolved</option>
                        </select>
                        <ChevronDown 
                          size={14} 
                          className="absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none opacity-60" 
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 shrink-0">
                          <span className="px-3 py-1.5 rounded-lg text-sm font-black uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                              Resolved
                          </span>
                          <button 
                              onClick={() => handleDelete(g.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Delete Record"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">{g.description}</p>
                </div>
                
                {/* Timestamps & Evidence */}
                <div className="flex gap-6 items-end border-t border-gray-100 pt-4 mt-2">
                  <div>
                    <p className="text-sm uppercase font-bold text-gray-400 mb-1">Logged On</p>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Clock size={14} className="text-gray-400"/>
                      <span className="text-sm font-bold">
                        {new Date(g.date_logged).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {viewMode === 'history' && g.date_resolved && (
                    <div>
                      <p className="text-sm uppercase font-bold text-green-600 mb-1">Resolved On</p>
                      <div className="flex items-center gap-1.5 text-green-700">
                        <CheckCircle size={14} />
                        <span className="text-sm font-bold">
                          {new Date(g.date_resolved).toLocaleDateString()}
                        </span>
                        <span className="text-sm text-green-600 font-bold ml-1">
                          {new Date(g.date_resolved).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="ml-auto">
                    {g.img_url ? (
                      <button 
                        onClick={() => setEvidenceModal(g.img_url)}
                        className="h-9 px-3 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-lg border border-blue-200 flex items-center gap-2 transition-all text-sm font-bold shadow-sm"
                      >
                        {g.img_url.endsWith('.mp4') ? <><FileVideo size={16} /> View Video</> : <><ImageIcon size={16} /> View Photo</>}
                      </button>
                    ) : (
                      <div className="h-9 px-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-2 text-gray-400 cursor-not-allowed text-sm font-bold">
                        <ImageIcon size={16} /> No Evidence
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const StudentMgmtTab = () => {
  const ALLOWED_BRANCHES = ['CSE', 'CIVIL', 'MECHANICAL', 'ELECTRICAL', 'ECE', 'IT', 'AIDS'];
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingStudents, setUploadingStudents] = useState(false);

  // Academic Filters
  const [filterBatch, setFilterBatch] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');

  // Edit State
  const [editingId, setEditingId] = useState(null); 
  const [editForm, setEditForm] = useState({}); 

  // Add Student State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadGuide, setShowUploadGuide] = useState(false);

  const [newStudent, setNewStudent] = useState({
    uid: '', full_name: '', dob: '', phone_no: '', room_no: '', batch: '', branch: '', address: ''
  });
  
  const [isLocked, setIsLocked] = useState(false);

  // --- ADD STUDENT LOGIC ---
  const handleAddStudent = async (e) => {
    e.preventDefault();
    toast.promise(
      axios.post('http://localhost:3001/api/warden/students', newStudent),
      {
        loading: 'Adding student...',
        success: (res) => {
          fetchStudents();
          setShowAddModal(false);
          setNewStudent({ uid: '', full_name: '', dob: '', phone_no: '', room_no: '', batch: '', branch: '', address: '' }); // Reset form
          return res.data.message;
        },
        error: (err) => err.response?.data?.error || 'Failed to add student.',
      }
    );
  };

  // --- DELETE STUDENT LOGIC ---
  const handleDelete = (student) => {
    setIsLocked(true); // Lock the screen!
    
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-center gap-2 text-red-600">
          <Trash2 size={20} />
          <p className="font-bold text-sm">Delete {student.full_name}?</p>
        </div>
        <p className="text-xs text-gray-500">This will permanently remove <b>{student.uid}</b> from the system.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => { toast.dismiss(t.id); setIsLocked(false); }} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { 
            toast.dismiss(t.id); 
            setIsLocked(false);
            
            toast.promise(
              axios.delete(`http://localhost:3001/api/warden/students/${student.uid}`),
              { loading: 'Deleting...', success: 'Student deleted!', error: 'Failed to delete student.' }
            ).then(() => fetchStudents());

          }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition">Delete</button>
        </div>
      </div>
    ), { id: `delete-${student.uid}`, duration: Infinity });
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = () => {
    setLoading(true);
    axios.get('http://localhost:3001/api/warden/students')
      .then(res => setStudents(res.data))
      .catch(err => console.error("Error fetching students:", err))
      .finally(() => setLoading(false));
  };

  const handleStudentCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingStudents(true);
    const formData = new FormData();
    formData.append('file', file);

    toast.promise(
      axios.post('http://localhost:3001/api/warden/students/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
      {
        loading: 'Syncing CSV to Database...',
        success: (res) => {
          fetchStudents(); 
          return res.data.message;
        },
        // display the exact Row Number that caused the crash
        error: (err) => {
          return err.response?.data?.error || 'Server error during upload.';
        },
      },
      {
        error: { duration: 6000 } 
      }
    ).finally(() => {
      setUploadingStudents(false);
      e.target.value = null; 
    });
  };

  const downloadTemplate = () => {
    const headers = "uid,full_name,dob,phone_no,address,room_no,batch,branch\n";
    const dummyData = "u2303004,Abhijith sreegith krishna,18-05-2005,9074907104,123 Campus Hostel,E-27,2023-27,CSE\n";
    
    const blob = new Blob([headers + dummyData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Student_Upload_Template.csv';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Template downloaded!");
  };
  
  const startEdit = (student) => {
    setEditingId(student.uid);
    setEditForm({ ...student });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    toast.promise(
      axios.put(`http://localhost:3001/api/warden/students/${editingId}`, editForm),
      {
        loading: 'Saving changes...',
        success: 'Student details updated!',
        error: 'Failed to update details.',
      }
    ).then(() => {
      setStudents(students.map(s => s.uid === editingId ? { ...editForm, checkout_count: s.checkout_count } : s));
      setEditingId(null);
    });
  };

  // Converts standard DB date into readable text for the table
  const formatDOB = (dobString) => {
    if (!dobString) return "N/A";
    const date = new Date(dobString);
    if (isNaN(date.getTime())) return "Invalid Date";
    
    // Returns e.g., "15/08/2005"
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); 
  };

  // Dynamically extract unique batches and branches from the data for the dropdowns
  const uniqueBatches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort();

  // Filter Logic
  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    
    // 1. Text Search
    const matchSearch = (
      (s.full_name || '').toLowerCase().includes(term) ||
      (s.uid || '').toLowerCase().includes(term) ||
      (s.room_no || '').toLowerCase().includes(term) ||
      (s.batch || '').toLowerCase().includes(term) ||
      (s.branch || '').toLowerCase().includes(term)
    );

    // 2. Dropdown Filters
    const matchBatch = filterBatch === 'All' ? true : s.batch === filterBatch;
    const matchBranch = filterBranch === 'All' ? true : s.branch === filterBranch;

    return matchSearch && matchBatch && matchBranch;
  });

  return (
    <div className="animate-fade-in p-2 sm:p-6">
      
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        
        {/* LEFT: Title & Counter */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Student Registry</h1>
          <p className="text-sm text-gray-500 mt-1">Manage {students.length} active residents</p>
        </div>

        {/* RIGHT: Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          
          {/* Help Guide Button */}
          <button 
            onClick={() => setShowUploadGuide(true)}
            className="p-2.5 bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-xl transition-colors shadow-sm"
            title="View Formatting Rules"
          >
            <HelpCircle size={18} />
          </button>
          
          {/* Download Template Button */}
          <button 
            onClick={downloadTemplate}
            className="px-3 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition shadow-sm flex items-center gap-2 text-sm"
            title="Download CSV formatting template"
          >
            <Download size={16} /> <span className="hidden sm:inline">CSV Template</span>
          </button>

          {/* Upload CSV Button */}
          <div className="relative overflow-hidden">
            <button 
              className="bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-xl font-bold hover:bg-green-100 hover:border-green-300 transition shadow-sm flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed" 
              disabled={uploadingStudents}
            >
              {uploadingStudents ? (
                <><span className="animate-spin">⏳</span> Syncing...</>
              ) : (
                <><Upload size={16} /> <span className="hidden sm:inline">Import CSV</span></>
              )}
            </button>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleStudentCSVUpload} 
              disabled={uploadingStudents}
              title="Upload Student Roster"
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>

          {/* Primary Action: Add Student */}
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* TOOLBAR: SEARCH & FILTERS */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name, UID, or room..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition text-sm font-medium text-gray-800"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex gap-3 w-full md:w-auto">
          
          {/* Branch Filter */}
          <div className="relative w-full sm:w-40">
            <select 
              value={filterBranch} 
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold cursor-pointer appearance-none shadow-sm"
            >
              <option value="All">All Branches</option>
              {ALLOWED_BRANCHES.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            {/* Custom Dropdown Arrow */}
            <ChevronDown size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500"/>
          </div>

          {/* Batch Filter */}
          {uniqueBatches.length > 0 && (
            <div className="relative w-full sm:w-36">
              <select 
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold cursor-pointer appearance-none shadow-sm"
              >
                <option value="All">All Batches</option>
                {uniqueBatches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {/* Custom Dropdown Arrow */}
              <ChevronDown size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-500"/>
            </div>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Student Profile</th>
                <th className="px-6 py-4">Room & Address</th>
                <th className="px-6 py-4">Activity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredStudents.length === 0 && !loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-400 bg-gray-50/50">
                    <div className="flex flex-col items-center gap-2">
                      <Users size={32} className="text-gray-300" />
                      <p className="font-medium">No students found matching your filters.</p>
                      {/* Quick clear filters button */}
                      {(filterBatch !== 'All' || filterBranch !== 'All' || searchTerm !== '') && (
                        <button 
                          onClick={() => {setFilterBatch('All'); setFilterBranch('All'); setSearchTerm('');}}
                          className="mt-2 text-blue-500 hover:text-blue-700 text-xs font-bold transition"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.uid} className={`transition-colors ${editingId === s.uid ? 'bg-blue-50/40' : 'hover:bg-blue-50/30'}`}>
                    
                    {/* COL 1: IDENTITY & ACADEMICS */}
                    <td className="px-6 py-4">
                      {editingId === s.uid ? (
                          <div className="space-y-2 max-w-[200px]">
                              <input 
                                value={editForm.full_name} 
                                onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                                className="w-full px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold shadow-sm"
                                placeholder="Full Name"
                              />
                              <input 
                                value={editForm.phone_no} 
                                onChange={(e) => setEditForm({...editForm, phone_no: e.target.value})}
                                className="w-full px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                                placeholder="Phone Number"
                              />
                              {/* Inline Edit inputs for Branch & Batch */}
                              <div className="flex gap-2">
                                <select 
                                  required 
                                  value={editForm.branch || ''} 
                                  onChange={e => setEditForm({...editForm, branch: e.target.value})} 
                                  className="w-1/2 px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-sm bg-white cursor-pointer"
                                  title="Select Branch"
                                >
                                  <option value="" disabled>Branch</option>
                                  {ALLOWED_BRANCHES.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                  ))}
                                </select>

                                <input 
                                  value={editForm.batch || ''} 
                                  onChange={(e) => setEditForm({...editForm, batch: e.target.value})}
                                  className="w-1/2 px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-sm"
                                  placeholder="Batch (2023-27)"
                                />
                              </div>
                          </div>
                      ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-black text-lg shrink-0">
                              {s.full_name ? s.full_name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{s.full_name}</p>
                              <p className="text-sm text-gray-500 font-medium">{s.uid}</p>
                              
                              {/* Academic Pills */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {s.branch && (
                                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-black uppercase tracking-wider border border-purple-100">
                                    {s.branch}
                                  </span>
                                )}
                                {s.batch && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-bold border border-gray-200">
                                    {s.batch}
                                  </span>
                                )}
                                {!s.branch && !s.batch && (
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                                    <Phone size={10} /> {s.phone_no || "No Data"}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                      )}
                    </td>

                    {/* COL 2: RESIDENCY */}
                    <td className="px-6 py-4 max-w-xs">
                      {editingId === s.uid ? (
                          <div className="space-y-2">
                              <input 
                                value={editForm.room_no || ''} 
                                onChange={(e) => setEditForm({...editForm, room_no: e.target.value})}
                                className="w-full px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold shadow-sm"
                                placeholder="Room Number"
                              />
                              <textarea 
                                value={editForm.address || ''} 
                                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                                className="w-full px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm resize-none"
                                rows={2}
                                placeholder="Home Address"
                              />
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-gray-400 shrink-0" />
                                <input 
                                  type="date" 
                                  value={editForm.dob ? editForm.dob.split('T')[0] : ''} 
                                  onChange={(e) => setEditForm({...editForm, dob: e.target.value})}
                                  className="w-full px-3 py-1.5 border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 text-xs shadow-sm font-bold text-gray-700"
                                  title="Date of Birth"
                                />
                              </div>
                          </div>
                      ) : (
                          <div className="flex flex-col items-start gap-1">
                             <span className="bg-gray-100 border border-gray-200 text-gray-700 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                               🚪 {s.room_no || "Unassigned"}
                             </span>
                             <p className="text-sm text-gray-500 truncate w-full mt-1" title={s.address}>
                               {s.address || "No Address Provided"}
                             </p>
                             <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 font-medium">
                               <Calendar size={12}/> DOB: {formatDOB(s.dob)}
                             </p>
                          </div>
                      )}
                    </td>

                    {/* COL 3: STATS */}
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Gate Activity</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold w-fit border ${
                            s.checkout_count >= 10 
                              ? 'bg-orange-50 text-orange-700 border-orange-200' 
                              : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                             <Shield size={14} /> 
                             {s.checkout_count || 0} {s.checkout_count === 1 ? 'Exit' : 'Exits'}
                          </span>
                       </div>
                    </td>

                    {/* COL 4: ACTIONS */}
                    <td className="px-6 py-4 text-right">
                      {editingId === s.uid ? (
                          <div className="flex justify-end gap-2">
                              <button 
                                onClick={cancelEdit} 
                                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-bold text-xs shadow-sm transition-colors" 
                                title="Cancel"
                              >
                                  <X size={14} /> Cancel
                              </button>
                              <button 
                                onClick={saveEdit} 
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-xs shadow-sm transition-colors" 
                                title="Save Changes"
                              >
                                  <Save size={14} /> Save
                              </button>
                          </div>
                      ) : (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => startEdit(s)} 
                              className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Edit Student"
                            >
                               <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(s)} 
                              className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-100"
                              title="Delete Student"
                            >
                               <Trash2 size={16} />
                            </button>
                          </div>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isLocked && <div className="fixed inset-0 z-[999] bg-black/10 backdrop-blur-[2px] cursor-not-allowed" />}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Plus size={20} className="text-blue-600" /> Manually Add Student
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleAddStudent} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">UID *</label>
                  <input required value={newStudent.uid} onChange={e => setNewStudent({...newStudent, uid: e.target.value})} placeholder="U1234567" className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold uppercase"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Date of Birth *</label>
                  <input required type="date" value={newStudent.dob} onChange={e => setNewStudent({...newStudent, dob: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Full Name *</label>
                <input required value={newStudent.full_name} onChange={e => setNewStudent({...newStudent, full_name: e.target.value})} placeholder="student name" className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Phone Number *</label>
                  <input required maxLength="10" value={newStudent.phone_no} onChange={e => setNewStudent({...newStudent, phone_no: e.target.value.replace(/[^0-9]/g, '')})} placeholder="10 Digits" className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Room *</label>
                  <input required value={newStudent.room_no} onChange={e => setNewStudent({...newStudent, room_no: e.target.value})} placeholder="e.g. E-27" className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm uppercase"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Branch *</label>
                  <select 
                    required 
                    value={newStudent.branch} 
                    onChange={e => setNewStudent({...newStudent, branch: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white cursor-pointer"
                  >
                    <option value="" disabled>Select Branch</option>
                    {ALLOWED_BRANCHES.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Batch *</label>
                  <input required value={newStudent.batch} onChange={e => setNewStudent({...newStudent, batch: e.target.value})} placeholder="e.g. 2023-27" className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Address *</label>
                <textarea required value={newStudent.address} onChange={e => setNewStudent({...newStudent, address: e.target.value})} placeholder="Home Address" rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"/>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 mt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition">Save Student</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-600" /> CSV Import Specifications
              </h2>
              <button onClick={() => setShowUploadGuide(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5 text-sm text-gray-600">
              
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                <p className="font-bold text-orange-800 flex items-center gap-2 mb-1.5">
                  <AlertOctagon size={16} /> Data Integrity Protocol
                </p>
                <p className="text-orange-700 text-sm leading-relaxed">
                  To ensure database consistency, bulk imports are processed as atomic transactions. Any formatting error or missing mandatory field (e.g., UID) will cause the entire batch upload to abort. Error logs will specify the exact row number requiring correction prior to re-upload.
                </p>
                <div className="mt-3 pt-3 border-t border-orange-200/50 flex items-start gap-2 text-green-700 text-xs font-bold">
                  <CheckCircle size={14} className="shrink-0 mt-0.5" />
                  <p>Duplicate Handling: Rows containing UIDs already registered in the database will be automatically bypassed without triggering an import failure.</p>
                </div>
              </div>
              
              <p className="text-sm font-medium text-gray-700">Please adhere to the following schema requirements for successful data ingestion:</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">UID</span>
                  Must commence with 'U' followed by exactly 7 numeric digits.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600 shadow-sm">Valid: U1234567</code>
                </div>
                
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Date of Birth (dob)</span>
                  Accepted formats: DD-MM-YYYY or DD/MM/YYYY.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600 shadow-sm">Valid: 15-08-2005</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Room (room_no)</span>
                  Required format: Single alphabet character, hyphen, followed by digits.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600 shadow-sm">Valid: A-101, B-22</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Batch</span>
                  Required format: YYYY-YY.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600 shadow-sm">Valid: 2023-27</code>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="font-bold text-blue-800 block mb-2">Permitted Branches (Exact Match Required)</span>
                <div className="flex flex-wrap gap-2">
                  {ALLOWED_BRANCHES.map(branch => (
                    <span key={branch} className="px-2 py-1 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-md shadow-sm">
                      {branch}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button onClick={() => setShowUploadGuide(false)} className="px-5 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition shadow-sm">
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DashboardHome = ({setActiveTab}) => {
  const [stats, setStats] = useState({
    total_students: 0,
    students_out: 0,
    pending_grievances: 0,
    mess_rating: "0.0" 
  });
  
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  useEffect(() => {
    axios.get('http://localhost:3001/api/warden/home-stats')
      .then(res => setStats(prev => ({...prev, ...res.data}))) 
      .catch(err => console.error("Stats fetch error:", err));
  }, []);

  return (
    <div className="animate-fade-in space-y-8 pb-10">
      
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Warden Dashboard</h1>
          <p className="text-gray-500 mt-1">System Overview & Alerts</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 shadow-sm flex items-center gap-2">
           <Calendar size={16} className="text-blue-500"/> {today}
        </div>
      </div>

      {/* 2. CRITICAL ALERTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card A: Security */}
        <div 
          onClick={() => setActiveTab('overnight')}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition"><LogOut size={80} /></div>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${stats.students_out > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              <LogOut size={24} />
            </div>
            {stats.students_out > 0 && <span className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>}
          </div>
          <h3 className="text-4xl font-black text-gray-800 mb-1">{stats.students_out}</h3>
          <p className="text-sm font-bold text-gray-400 group-hover:text-red-600 transition flex items-center gap-1">
             Students Out <ChevronRight size={14}/>
          </p>
        </div>

        {/* Card B: Maintenance */}
        <div 
          onClick={() => setActiveTab('grievances')}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition"><AlertCircle size={80} /></div>
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl ${stats.pending_grievances > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
              <AlertCircle size={24} />
            </div>
            {stats.pending_grievances > 0 && <span className="animate-pulse w-2 h-2 bg-orange-500 rounded-full"></span>}
          </div>
          <h3 className="text-4xl font-black text-gray-800 mb-1">{stats.pending_grievances}</h3>
          <p className="text-sm font-bold text-gray-400 group-hover:text-orange-600 transition flex items-center gap-1">
             Pending Complaints <ChevronRight size={14}/>
          </p>
        </div>

        {/* Card C: Mess Intelligence */}
        <div 
          onClick={() => setActiveTab('mess')}
          className="bg-gradient-to-br from-blue-600 to-indigo-800 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden cursor-pointer group hover:shadow-xl transition flex flex-col justify-between"
        >
          <div className="relative z-10 flex justify-between items-start">
             <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
               <Star size={24} className="text-yellow-300 fill-yellow-300" />
             </div>
             <span className="bg-blue-500/50 px-2 py-1 rounded text-xs font-bold backdrop-blur-sm flex items-center gap-1">
               LIVE <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
             </span>
          </div>
          
          <div className="relative z-10 mt-4">
             <div className="flex items-end gap-2 mb-1">
               <h3 className="text-4xl font-black">{stats.mess_rating}</h3>
               <span className="text-blue-200 mb-1 font-bold text-lg">/ 5.0</span>
             </div>
             <p className="text-sm font-bold text-blue-100 group-hover:text-white transition flex items-center gap-1">
                Today's Mess Average <ChevronRight size={14}/>
             </p>
          </div>

          {/* Decorative Graph Line */}
          <div className="absolute bottom-0 left-0 w-full h-24 opacity-20">
             <svg viewBox="0 0 100 20" className="fill-current text-white w-full h-full preserve-3d">
                <path d="M0 20 L0 10 Q20 5 40 12 T80 8 T100 15 L100 20 Z" />
             </svg>
          </div>
        </div>

      </div>

      {/* 3. FUNCTIONALITY GRID */}
      <div>
        <h3 className="font-bold text-gray-800 mb-4 text-lg">System Modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <button onClick={() => setActiveTab('students')} className="p-5 bg-white border border-gray-200 rounded-2xl hover:border-blue-400 hover:shadow-lg transition text-left group flex flex-col justify-between h-32">
               <div className="bg-blue-50 w-fit p-3 rounded-xl text-blue-600 group-hover:scale-110 transition mb-3"><Users size={22}/></div>
               <div>
                  <h3 className="font-bold text-gray-700">Resident Directory</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Manage {stats.total_students} students</p>
               </div>
            </button>

            <button onClick={() => setActiveTab('menu')} className="p-5 bg-white border border-gray-200 rounded-2xl hover:border-purple-400 hover:shadow-lg transition text-left group flex flex-col justify-between h-32">
               <div className="bg-purple-50 w-fit p-3 rounded-xl text-purple-600 group-hover:scale-110 transition mb-3"><ClipboardList size={22}/></div>
               <div>
                  <h3 className="font-bold text-gray-700">Weekly Menu</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Update food schedule</p>
               </div>
            </button>

            <button onClick={() => setActiveTab('overnight')} className="p-5 bg-white border border-gray-200 rounded-2xl hover:border-red-400 hover:shadow-lg transition text-left group flex flex-col justify-between h-32">
               <div className="bg-red-50 w-fit p-3 rounded-xl text-red-600 group-hover:scale-110 transition mb-3"><Moon size={22}/></div>
               <div>
                  <h3 className="font-bold text-gray-700">Overnight Log</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Track late entries</p>
               </div>
            </button>

            <button onClick={() => setActiveTab('mess')} className="p-5 bg-white border border-gray-200 rounded-2xl hover:border-green-400 hover:shadow-lg transition text-left group flex flex-col justify-between h-32">
               <div className="bg-green-50 w-fit p-3 rounded-xl text-green-600 group-hover:scale-110 transition mb-3"><CheckCircle size={22}/></div>
               <div>
                  <h3 className="font-bold text-gray-700">Feedback Hub</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Analyze student ratings</p>
               </div>
            </button>

        </div>
      </div>

    </div>
  );
};

const MenuTab = () => {
  // --- STATE ---
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [catalog, setCatalog] = useState([]);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDietFilter, setCatalogDietFilter] = useState('All');
  const [catalogSort, setCatalogSort] = useState('name');

  const [mealTimings, setMealTimings] = useState({
    Breakfast: { start: '00:00', end: '00:00' },
    Lunch: { start: '00:00', end: '00:00' },
    Dinner: { start: '00:00', end: '00:00' }
  });
  
  const [uploading, setUploading] = useState(false);
  const [timeEditModal, setTimeEditModal] = useState(null); 
  
  // --- MODAL STATES ---
  const [ShowCatalogModal, setShowCatalogModal] = useState(false);
  const [assignModalData, setAssignModalData] = useState(null); 
  const [showAIModal, setShowAIModal] = useState(false);
  
  // Inline Editing State
  const [editingDishId, setEditingDishId] = useState(null);
  const [editDishForm, setEditDishForm] = useState({});

  const [showUploadGuide, setShowUploadGuide] = useState(false);
  const [showCatalogUploadGuide, setShowCatalogUploadGuide] = useState(false);
  const [showAIGuide, setShowAIGuide] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const abortControllerRef = useRef(null);

  // --- FORM STATES ---
  const [newDish, setNewDish] = useState({ dish_name: '', diet_type: 'Veg', cost: '', effort_score: '' });
  const [selectedDishId, setSelectedDishId] = useState('');

  // --- HANDLERS ---

  const handleAssignDish = (e) => {
    e.preventDefault();
    if (!selectedDishId) return toast.error("Please select a dish!");
    
    const existingDishesInSlot = getDishesForSlot(assignModalData.dateString, assignModalData.mealType);
    if (existingDishesInSlot.length >= 2) {
      toast.error(`Maximum 2 dishes allowed for ${assignModalData.mealType}.`);
      return; 
    }

    const dishObj = catalog.find(d => d.id === parseInt(selectedDishId));
    
    const newEntry = {
      schedule_id: `temp_${Date.now()}_${Math.random()}`, 
      serve_date: assignModalData.dateString,
      meal_type: assignModalData.mealType,
      dish_id: dishObj.id,
      status: 'Draft', 
      dish_name: dishObj.dish_name,
      diet_type: dishObj.diet_type,
      cost: dishObj.cost,
      effort_score: dishObj.effort_score
    };

    setWeeklyMenu(prev => [...prev, newEntry]);
    setAssignModalData(null); 
    setSelectedDishId(''); 
  };

  const handleAddDish = async (e) => {
    e.preventDefault();
    toast.promise(
      axios.post('http://localhost:3001/api/admin/menu-catalog', newDish),
      {
        loading: 'Adding dish to catalog...',
        success: (res) => {
          setShowCatalogModal(false);
          setNewDish({ dish_name: '', diet_type: 'Veg', cost: '', effort_score: '' });
          fetchCatalog();
          return res.data.message;
        },
        error: (err) => err.response?.data?.error || "Failed to add dish.",
      }
    );
  };

  const executeDeleteFromCatalog = async (dishId, dishName) => {
    toast.promise(
      axios.delete(`http://localhost:3001/api/admin/menu-catalog/${dishId}`),
      {
        loading: 'Deleting dish...',
        success: `${dishName} permanently removed.`,
        error: (err) => err.response?.data?.error || "Failed to delete dish."
      }
    ).then(() => fetchCatalog());
  };

  const handleDeleteFromCatalog = (dishId, dishName) => {
    const dish = catalog.find(d => d.id === dishId);
    const isCurrentlyScheduled = dish && dish.served_meals;

    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[300px]">
        <div className="flex items-center gap-2 text-red-600">
          <Trash2 size={20} />
          <p className="font-bold text-sm">Confirm Deletion of {dishName}?</p>
        </div>
        
        {isCurrentlyScheduled ? (
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <p className="text-xs font-bold text-red-700 flex items-center gap-1 mb-1">
              <AlertTriangle size={14} /> WARNING
            </p>
            <p className="text-xs text-red-600 font-medium leading-relaxed">
              This meal is already approved/assigned as an active menu item. Proceeding might cause Cascade error, Confirm deletion?
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">This will remove it from your active catalog.</p>
        )}

        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { 
            toast.dismiss(t.id); 
            executeDeleteFromCatalog(dishId, dishName); 
          }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition shadow-sm">
            Yes, Proceed
          </button>
        </div>
      </div>
    ), { id: `delete-dish-${dishId}`, duration: Infinity });
  };
   
  const handleEditClick = (dish) => {
    setEditingDishId(dish.id);
    setEditDishForm({ ...dish });
  };

  const handleCancelEdit = () => {
    setEditingDishId(null);
    setEditDishForm({});
  };

  const executeUpdateDish = async (e) => {
    e.preventDefault();
    toast.promise(
      axios.put(`http://localhost:3001/api/admin/menu-catalog/${editingDishId}`, editDishForm),
      {
        loading: 'Saving changes...',
        success: () => {
          setEditingDishId(null);
          fetchCatalog(); 
          return 'Dish updated successfully!';
        },
        error: (err) => err.response?.data?.error || "Failed to update dish."
      }
    );
  };

  const executeBulkDeleteCatalog = async (dishesToDelete) => {
    toast.promise(
      Promise.all(dishesToDelete.map(d => axios.delete(`http://localhost:3001/api/admin/menu-catalog/${d.id}`))),
      {
        loading: `Deleting ${dishesToDelete.length} dishes...`,
        success: `Successfully deleted selected dishes!`,
        error: 'Some dishes could not be deleted because they are currently scheduled on the active menu.'
      }
    ).then(() => fetchCatalog());
  };

  const handleBulkDeleteCatalog = () => {
    if (filteredCatalog.length === 0) return;
    
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[300px]">
        <div className="flex items-start gap-2 text-red-600">
          <AlertOctagon size={24} className="shrink-0" />
          <div>
            <p className="font-bold text-sm">Delete {filteredCatalog.length} Dishes?</p>
            <p className="text-xs text-gray-500 mt-1">This will permanently remove all currently filtered dishes from your database.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { 
            toast.dismiss(t.id); 
            executeBulkDeleteCatalog(filteredCatalog); 
          }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition shadow-sm">Delete All</button>
        </div>
      </div>
    ), { id: 'bulk-delete-catalog', duration: Infinity });
  };

  const executeApproveWeek = async (startStr, endStr) => {
    toast.promise(
      axios.put('http://localhost:3001/api/admin/weekly-menu/sync', {
        start_date: startStr,
        end_date: endStr,
        menu_items: weeklyMenu
      }),
      {
        loading: 'Syncing to database...',
        success: "Week's menu officially published!",
        error: "Failed to publish schedule."
      }
    ).then(() => {fetchWeeklyMenu();fetchCatalog();});
  };

  const handleApproveWeek = () => {
    const startStr = weekDays[0].dateString;
    const endStr = weekDays[6].dateString;

    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[300px]">
        <div className="flex items-start gap-2 text-blue-600">
          <CheckCircle size={24} className="shrink-0" />
          <div>
            <p className="font-bold text-sm">Publish Weekly Schedule?</p>
            <p className="text-sm text-gray-500 mt-1">This will overwrite the current live menu for {startStr} to {endStr}.</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Keep as Draft</button>
          <button onClick={() => { toast.dismiss(t.id); executeApproveWeek(startStr, endStr); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">Publish Now</button>
        </div>
      </div>
    ), { id: 'publish-week', duration: Infinity });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    toast.promise(
      axios.post('http://localhost:3001/api/admin/menu-catalog/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      }),
      {
        loading: 'Importing dishes...',
        success: (res) => {
          fetchCatalog();
          return res.data.message;
        },
        error: 'Failed to upload CSV.',
      }
    ).finally(() => {
      setUploading(false);
      e.target.value = null; 
    });
  };

  const handleScheduleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(row => row.trim() !== '');
      const headers = rows.shift().split(',').map(h => h.trim().toLowerCase());

      const dateIdx = headers.indexOf('serve_date');
      const mealIdx = headers.indexOf('meal_type');
      const nameIdx = headers.indexOf('dish_name');
      const dietIdx = headers.indexOf('diet_type');
      const costIdx = headers.indexOf('cost');
      const effortIdx = headers.indexOf('effort_score');

      if (dateIdx === -1 || mealIdx === -1 || nameIdx === -1) {
        toast.error("CSV must contain 'serve_date', 'meal_type', and 'dish_name'.");
        return;
      }

      const uploadedDates = [...new Set(rows.map(rowStr => rowStr.split(',')[dateIdx].trim()))];
      const currentVisibleDates = weekDays.map(d => d.dateString);

      const draftMenu = weeklyMenu.filter(m => {
        const existingDate = m.serve_date.split('T')[0]; 
        return !uploadedDates.includes(existingDate);
      });

      let comboErrors = 0;
      let limitErrors = 0;
      let newItemsCount = 0;
      let addedCount = 0;
      let hiddenCount = 0; 

      rows.forEach((rowStr, index) => {
        const row = rowStr.split(',').map(v => v.trim());
        if (row.length < 3) return;

        const serveDate = row[dateIdx];
        const mealType = row[mealIdx];
        const dishName = row[nameIdx];
        const dietType = dietIdx !== -1 && row[dietIdx] ? row[dietIdx] : 'Veg';
        const cost = costIdx !== -1 ? (parseInt(row[costIdx]) || 0) : 0;
        const effortScore = effortIdx !== -1 ? (parseInt(row[effortIdx]) || 5) : 5;

        if (!/(&|\+|\band\b)/i.test(dishName)) {
          comboErrors++;
          return;
        }

        const existingInSlot = draftMenu.filter(m => m.serve_date.split('T')[0] === serveDate && m.meal_type === mealType);
        if (existingInSlot.length >= 2) {
          limitErrors++;
          return;
        }

        const existingDish = catalog.find(d => d.dish_name.toLowerCase() === dishName.toLowerCase());

        draftMenu.push({
          schedule_id: `csv_draft_${Date.now()}_${index}`,
          serve_date: serveDate,
          meal_type: mealType,
          dish_id: existingDish ? existingDish.id : null,
          is_new_creation: !existingDish, 
          status: 'Draft',
          is_new_recipe_badge: !existingDish, 
          dish_name: dishName,
          diet_type: existingDish ? existingDish.diet_type : dietType,
          cost: existingDish ? existingDish.cost : cost,
          effort_score: existingDish ? existingDish.effort_score : effortScore
        });

        addedCount++;
        if (!existingDish) newItemsCount++;
        
        if (!currentVisibleDates.includes(serveDate)) {
          hiddenCount++;
        }
      });

      setWeeklyMenu(draftMenu);

      const visibilityMsg = hiddenCount > 0 
        ? `\nNote: ${hiddenCount} meals are scheduled for a different week. Navigate to those dates to see them.` 
        : "";

      if (comboErrors > 0 || limitErrors > 0) {
        toast.success(
          `Imported ${addedCount} meals. Found ${newItemsCount} new recipes! ${visibilityMsg}
           \nBlocked: ${comboErrors} invalid names, ${limitErrors} due to slot limits.`,
          { duration: 7000 }
        );
      } else {
        toast.success(`Successfully loaded ${addedCount} meals! Found ${newItemsCount} new recipes. ${visibilityMsg}`, { duration: 5000 });
      }
    };
    
    reader.readAsText(file);
    e.target.value = null; 
  };
  
  const handleRemoveDish = (scheduleId, dishName) => {
    setWeeklyMenu(prev => prev.filter(dish => dish.schedule_id !== scheduleId));
  };

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
  });

  const handlePrevWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleClearWeek = () => {
    if (weeklyMenu.length === 0) {
      toast.error("The grid is already empty!");
      return;
    }

    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[280px]">
        <div className="flex items-center gap-2 text-red-600">
          <Trash2 size={20} />
          <p className="font-bold text-sm">Clear This Week's Grid?</p>
        </div>
        <p className="text-sm text-gray-500">This removes all meals from the screen. It will not affect the live app until you click Publish.</p>
        <div className="flex gap-2 justify-end mt-2">
          <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">Cancel</button>
          <button onClick={() => { 
            toast.dismiss(t.id); 
            setWeeklyMenu([]); 
            toast.success("Grid cleared! Click Publish to save these changes.");
          }} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition">Clear Grid</button>
        </div>
      </div>
    ), { id: 'clear-week', duration: Infinity });
  };

  const todayString = new Date().toLocaleDateString('en-CA');

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      dateString: date.toLocaleDateString('en-CA') 
    };
  });

  useEffect(() => {
    fetchCatalog();
    fetchWeeklyMenu();
    fetchTimings();
  }, [weekStart]); 

  const fetchCatalog = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/admin/menu-catalog');
      setCatalog(res.data);
    } catch (err) {
      console.error("Failed to fetch catalog", err);
    }
  };

  const fetchWeeklyMenu = async () => {
    const startStr = weekDays[0].dateString;
    const endStr = weekDays[6].dateString;
    try {
      const res = await axios.get(`http://localhost:3001/api/admin/weekly-menu?start=${startStr}&end=${endStr}`);
      setWeeklyMenu(res.data);
    } catch (err) {
      console.error("Failed to fetch weekly schedule", err);
    }
  };

  const getDishesForSlot = (date, mealType) => {
    return weeklyMenu.filter(m => m.serve_date === date && m.meal_type === mealType);  
  };

  const fetchTimings = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/admin/meal-timings');
      setMealTimings(res.data);
    } catch (err) {
      console.error("Failed to fetch timings", err);
    }
  };

  const handleUpdateTiming = async (e) => {
    e.preventDefault();
    try {
      await axios.put('http://localhost:3001/api/admin/meal-timings', {
        meal_type: timeEditModal.meal,
        start_time: timeEditModal.start,
        end_time: timeEditModal.end
      });
      fetchTimings(); 
      setTimeEditModal(null); 
    } catch (err) {
      console.error("Error updating time:", err);
      alert("Failed to update timing.");
    }
  };

  const ask_ai = async () => {
    setAiLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const res = await axios.post('http://localhost:3001/api/admin/ga-generate-menu', {
        start_date: weekDays[0].dateString,
        end_date: weekDays[6].dateString, 
        custom_prompt: aiPrompt
      }, {
        signal: abortControllerRef.current.signal 
      });       
      
      const populatedMenu = res.data.proposed_menu.map((item, index) => {
        
        if (item.is_new_creation) {
           return {
              schedule_id: `temp_new_ai_${Date.now()}_${index}`,
              serve_date: item.serve_date,
              meal_type: item.meal_type,
              dish_id: null, 
              is_new_creation: true, 
              status: 'AI Draft', 
              is_new_recipe_badge: true, 
              dish_name: item.dish_name,
              diet_type: item.diet_type,
              cost: item.cost || 0,
              effort_score: item.effort_score || 5
           };
        }

        const dishObj = catalog.find(d => d.id === parseInt(item.dish_id));
        if (!dishObj) return null;
        
        return {
            schedule_id: `temp_ai_${Date.now()}_${index}`,
            serve_date: item.serve_date,
            meal_type: item.meal_type,
            dish_id: dishObj.id,
            is_new_creation: false,
            status: 'AI Draft',
            dish_name: dishObj.dish_name,
            diet_type: dishObj.diet_type,
            cost: dishObj.cost,
            effort_score: dishObj.effort_score
        };
      }).filter(Boolean);

      setWeeklyMenu(populatedMenu);
      setShowAIModal(false);
      toast.success("AI draft generated! Review the new recipes and click Publish to lock them in.");      
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log("AI Generation was aborted by the user.");
      } else {
        alert(err.response?.data?.error || "AI Generation Failed");
      }
    } finally {
      setAiLoading(false);
    }
  }

  const format12Hour = (time24) => {
    if (!time24 || time24 === '00:00') return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${m} ${suffix}`;
  };

  const weeklyMetrics = useMemo(() => {
    const currentVisibleDates = weekDays.map(d => d.dateString);
    const visibleMeals = weeklyMenu.filter(meal => {
      const mealDate = meal.serve_date.split('T')[0];
      return currentVisibleDates.includes(mealDate);
    });

    if (!visibleMeals || visibleMeals.length === 0) {
      return { totalCost: 0, avgCost: 0, avgEffort: 0, highestEffortDay: "N/A" };
    }

    let totalC = 0;
    let totalE = 0;
    let count = visibleMeals.length;
    let dailyEffortTracker = {};

    visibleMeals.forEach(meal => {
      totalC += Number(meal.cost) || 0;
      totalE += Number(meal.effort_score) || 0;
      
      const day = meal.serve_date.split('T')[0];
      if (!dailyEffortTracker[day]) dailyEffortTracker[day] = 0;
      dailyEffortTracker[day] += Number(meal.effort_score) || 0;
    });

    let maxEffort = 0;
    let hardestDay = "N/A";
    Object.entries(dailyEffortTracker).forEach(([day, effort]) => {
        if (effort > maxEffort) {
            maxEffort = effort;
            hardestDay = new Date(day).toLocaleDateString('en-US', { weekday: 'long' });
        }
    });

    return {
      totalCost: totalC.toFixed(2),
      avgCost: (totalC / count).toFixed(2),
      avgEffort: (totalE / count).toFixed(1),
      highestEffortDay: hardestDay
    };
  }, [weeklyMenu, weekDays]);

  const filteredCatalog = useMemo(() => {
    let result = catalog.filter(dish => 
      dish.dish_name.toLowerCase().includes(catalogSearch.toLowerCase())
    );

    if (catalogDietFilter !== 'All') {
      result = result.filter(dish => dish.diet_type === catalogDietFilter);
    }

    result.sort((a, b) => {
      if (catalogSort === 'name') return a.dish_name.localeCompare(b.dish_name);
      if (catalogSort === 'cost') return b.cost - a.cost; 
      if (catalogSort === 'effort') return b.effort_score - a.effort_score; 
      if (catalogSort === 'popularity') return (b.popularity_score || 0) - (a.popularity_score || 0); 
      return 0;
    });

    return result;
  }, [catalog, catalogSearch, catalogDietFilter, catalogSort]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-800 text-white">
          
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold hidden md:block">Weekly Menu Planner</h2>
            
            <div className="flex items-center gap-1 bg-gray-700/50 p-1 rounded-lg border border-gray-600">
              <button onClick={handlePrevWeek} className="p-1.5 hover:bg-gray-600 rounded-md transition" title="Previous Week">
                <span className="text-lg font-bold leading-none">‹</span>
              </button>
              <div className="flex flex-col items-center px-3">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Week Of</span>
                <span className="text-sm font-bold text-blue-300">{weekDays[0].dateString}</span>
              </div>
              <button onClick={handleNextWeek} className="p-1.5 hover:bg-gray-600 rounded-md transition" title="Next Week">
                <span className="text-lg font-bold leading-none">›</span>
              </button>
            </div>
            <button 
              onClick={handleClearWeek}
              className="bg-gray-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all text-sm shadow-sm"
              title="Clear all meals from the grid"
            >
              <Trash2 size={16} /> <span className="hidden xl:inline">Clear</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 ml-2">
              <button 
                onClick={() => setShowUploadGuide(true)}
                className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100"
                title="View CSV Formatting Rules"
              >
                <HelpCircle size={20} />
              </button>

              <div className="relative overflow-hidden">
                <button className="bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all text-sm shadow-sm">
                  <Upload size={16} /> <span className="hidden xl:inline">Import Menu</span>
                </button>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleScheduleCSVUpload} 
                  title="Upload Weekly Schedule CSV"
                  className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

            <button 
              onClick={() => setShowAIModal(true)}
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:scale-105 transition-all active:scale-95 border border-purple-400/50 text-sm"
            >
              <Sparkles size={16} className="animate-pulse" /> AI Auto-Schedule
            </button>

            <button className="bg-green-500 hover:bg-green-600 px-4 py-2.5 rounded-xl shadow transition text-sm font-bold ml-2" onClick={() => setShowCatalogModal(true)}>
              + Manage Catalog
            </button>
          </div>
        </div>

        {/* THE GRID */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase text-sm">
                <th className="p-4 border-b w-1/4">Day / Date</th>
                
                {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
                  <th key={meal} className="p-4 border-b w-1/4 group relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-base font-bold">{meal}</span>
                        <span className="text-xs text-gray-500 font-normal lowercase tracking-wide">
                          {format12Hour(mealTimings[meal].start)} - {format12Hour(mealTimings[meal].end)}
                        </span>
                      </div>
                      
                      <button 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-xs hover:underline bg-blue-50 px-2 py-1 rounded"
                        onClick={() => setTimeEditModal({ meal: meal, start: mealTimings[meal].start, end: mealTimings[meal].end })}
                      >
                        Edit Time
                      </button>
                    </div>
                  </th>
                ))}
                
              </tr>
            </thead>
            <tbody>
              {weekDays.map((day) => {
                const isToday = day.dateString === todayString;

                return (
                  <tr 
                    key={day.dateString} 
                    className={`transition-colors ${isToday ? "bg-blue-50 border-l-4 border-blue-500 shadow-sm" : "hover:bg-gray-50 border-b"}`}
                  >
                    <td className="p-4 border-r">
                      <div className={`font-bold text-lg ${isToday ? "text-blue-700" : "text-gray-800"}`}>
                        {day.dayName} {isToday && <span className="text-sm font-normal bg-blue-200 text-blue-800 px-2 py-0.5 rounded ml-2">Today</span>}
                      </div>
                      <div className="text-sm text-gray-500">{day.dateString}</div>
                    </td>

                    {['Breakfast', 'Lunch', 'Dinner'].map((meal) => {
                     const assignedDishes = getDishesForSlot(day.dateString, meal);
                      
                      return (
                        <td key={meal} className="p-4 border-r align-top">
                          <div className="flex flex-col gap-2 h-full">
                            
                            {assignedDishes.map((dish) => (
                              <div key={dish.schedule_id} className={`p-2 rounded border text-sm relative group pr-6 ${
                                   dish.diet_type === 'Veg' ? 'bg-green-100 text-green-700' : 
                                   dish.diet_type === 'Common' ? 'bg-blue-100 text-blue-700' : 
                                   'bg-red-100 text-red-700'
                                }`}>
                                
                                <span className="font-semibold block">{dish.dish_name}</span>
                                
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs opacity-75">{dish.diet_type}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                                    dish.is_new_recipe_badge ? 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' :
                                    dish.status === 'AI Draft' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                    dish.status === 'Draft' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                                    dish.status === 'Approved' ? 'bg-blue-100 text-blue-700' : 
                                    'bg-yellow-200 text-yellow-800'
                                  }`}>
                                    {dish.is_new_recipe_badge ? '✨ NEW RECIPE' : dish.status === 'AI Draft' ? '🤖 AI Draft' : dish.status}
                                  </span>
                                </div>
                                
                                <button 
                                  onClick={() => handleRemoveDish(dish.schedule_id, dish.dish_name)}
                                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                  title="Remove from schedule"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            {assignedDishes.length < 2 && (
                              <button 
                                onClick={() => setAssignModalData({ dateString: day.dateString, mealType: meal })}
                                className={`w-full border-2 border-dashed border-gray-300 rounded text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center ${assignedDishes.length > 0 ? 'py-1 text-xs mt-auto' : 'h-full min-h-[60px]'}`}
                                title={`Add up to 2 items (${2 - assignedDishes.length} slot(s) remaining)`}
                              >
                                + {assignedDishes.length > 0 ? 'Add 2nd Option' : 'Assign'}
                              </button>
                            )}
                            
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --- WEEKLY OPERATIONS SUMMARY --- */}
        <div className="mt-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 animate-fade-in">
          
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Weekly Operations Brief</h3>
            <p className="text-xs text-gray-500 mt-1">Estimated metrics per student for the selected week.</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="bg-green-50 px-4 py-3 rounded-xl border border-green-100 flex items-center gap-4 min-w-[160px]">
               <div className="bg-green-200 text-green-700 p-2 rounded-lg font-black text-xl">₹</div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-green-600 tracking-wider">Total Cost</p>
                 <p className="font-black text-green-900 text-lg">₹{weeklyMetrics.totalCost}</p>
               </div>
            </div>
            
            <div className="bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 flex items-center gap-3 flex-1 min-w-[140px]">
               <div className="bg-blue-200 text-blue-700 p-2 rounded-lg font-black text-lg">⚖</div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Avg Cost/Meal</p>
                 <p className="font-black text-blue-900 text-lg">₹{weeklyMetrics.avgCost}</p>
               </div>
            </div>

            <div className="bg-orange-50 px-4 py-3 rounded-xl border border-orange-100 flex items-center gap-4 min-w-[160px]">
               <div className="bg-orange-200 text-orange-700 p-2 rounded-lg font-black text-xl">♨</div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Avg Labor Effort</p>
                 <p className="font-black text-orange-900 text-lg">{weeklyMetrics.avgEffort} / 10</p>
               </div>
            </div>

            <div className="bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-4 min-w-[160px]">
               <div className="bg-red-200 text-red-700 p-2 rounded-lg font-black text-xl">⚠</div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Hardest Shift</p>
                 <p className="font-black text-red-900 text-lg">{weeklyMetrics.highestEffortDay}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Click approve to publish this week's menu to the Student App.
            </p>
            <button 
              onClick={handleApproveWeek}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded shadow transition flex items-center gap-2"
            >
              ✓ Approve Week's Menu
            </button>
        </div>
      </div>

      {/* MODAL 1: ADD TO CATALOG                   */}
      {ShowCatalogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
            
            <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-xl text-gray-800">Manage Menu Catalog</h2>
                <p className="text-sm text-gray-500">Add new dishes or remove old ones.</p>
              </div>
              <button onClick={() => setShowCatalogModal(false)} className="text-gray-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm transition">
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-8">
              
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-600 p-1 rounded">+</span> Add New Combo
                </h3>
                <form onSubmit={handleAddDish} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Combo Name</label>
                    <input 
                      type="text" required
                      value={newDish.dish_name} 
                      onChange={(e) => setNewDish({...newDish, dish_name: e.target.value})}
                      placeholder="e.g. Chappathi & Butter Chicken" 
                      className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Diet Type</label>
                    <select 
                      value={newDish.diet_type} 
                      onChange={(e) => setNewDish({...newDish, diet_type: e.target.value})}
                      className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Veg">Veg</option>
                      <option value="Non-Veg">Non-Veg</option>
                      <option value="Common">Common (Both)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Base Cost (₹)</label>
                    <input 
                      type="number" min="0" required
                      value={newDish.cost} 
                      onChange={(e) => setNewDish({...newDish, cost: e.target.value})}
                      placeholder="e.g. 45" 
                      className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Prep Effort (1-10)</label>
                    <input 
                      type="number" min="1" max="10" required
                      value={newDish.effort_score} 
                      onChange={(e) => setNewDish({...newDish, effort_score: e.target.value})}
                      placeholder="e.g. 5" 
                      className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-end h-full">
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition active:scale-95">
                      Save Meal
                    </button>
                  </div>
                  
                </form>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button 
                    type="button"
                    onClick={() => setShowCatalogUploadGuide(true)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                    title="View Catalog CSV Formatting Rules"
                  >
                    <HelpCircle size={20} />
                  </button>

                  <div className="relative overflow-hidden inline-block">
                      <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 text-sm shadow-sm" disabled={uploading}>
                        {uploading ? 'Processing...' : 'Bulk Upload Catalog (CSV)'}
                      </button>
                      <input 
                        type="file" 
                        accept=".csv" 
                        onChange={handleFileUpload} 
                        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                      />
                  </div>
                </div>
              </div>

              <div>   
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  
                  <div className="flex flex-col gap-3 w-full md:w-auto">
                    <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider flex items-center gap-2">
                      Database Controls <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{filteredCatalog.length} items</span>
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative w-full sm:w-48">
                        <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Search..." 
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        />
                      </div>

                      <select 
                        value={catalogDietFilter}
                        onChange={(e) => setCatalogDietFilter(e.target.value)}
                        className="py-1.5 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                      >
                        <option value="All">All Diets</option>
                        <option value="Veg">Veg</option>
                        <option value="Non-Veg">Non-Veg</option>
                        <option value="Common">Common</option>
                      </select>

                      <select 
                        value={catalogSort}
                        onChange={(e) => setCatalogSort(e.target.value)}
                        className="py-1.5 px-3 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 cursor-pointer"
                      >
                        <option value="name">Sort by: Name</option>
                        <option value="popularity">Sort by: Popularity ⭐</option>
                        <option value="cost">Sort by: Cost ₹</option>
                        <option value="effort">Sort by: Effort ♨</option>
                      </select>
                    </div>
                  </div>

                  {filteredCatalog.length > 0 && (
                    <button 
                      onClick={handleBulkDeleteCatalog}
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-bold hover:bg-red-100 transition active:scale-95"
                    >
                      <Trash2 size={16} /> Delete Filtered
                    </button>
                  )}
                </div>

                {filteredCatalog.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <Filter size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-bold">No dishes found.</p>
                    <p className="text-sm mt-1">Try adjusting your filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredCatalog.map(dish => (
                      editingDishId === dish.id ? (
                        
                        <form key={`edit-${dish.id}`} onSubmit={executeUpdateDish} className="bg-blue-50/50 p-4 rounded-xl border-2 border-blue-400 shadow-sm transition-all flex flex-col justify-between">
                          <div className="space-y-3 mb-3">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Dish Name (Combo)</label>
                              <input 
                                type="text" required
                                value={editDishForm.dish_name} 
                                onChange={(e) => setEditDishForm({...editDishForm, dish_name: e.target.value})}
                                className="w-full text-sm font-bold px-3 py-1.5 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-1 shadow-sm"
                              />
                            </div>
                            
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <label className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Diet</label>
                                <select 
                                  value={editDishForm.diet_type} 
                                  onChange={(e) => setEditDishForm({...editDishForm, diet_type: e.target.value})}
                                  className="w-full text-xs px-2 py-1.5 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-1 shadow-sm"
                                >
                                  <option value="Veg">Veg</option>
                                  <option value="Non-Veg">Non-Veg</option>
                                  <option value="Common">Common</option>
                                </select>
                              </div>
                              <div className="w-20">
                                <label className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Cost (₹)</label>
                                <input 
                                  type="number" required min="0"
                                  value={editDishForm.cost} 
                                  onChange={(e) => setEditDishForm({...editDishForm, cost: e.target.value})}
                                  className="w-full text-xs px-2 py-1.5 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-1 shadow-sm"
                                />
                              </div>
                              <div className="w-20">
                                <label className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Effort</label>
                                <input 
                                  type="number" required min="1" max="10"
                                  value={editDishForm.effort_score} 
                                  onChange={(e) => setEditDishForm({...editDishForm, effort_score: e.target.value})}
                                  className="w-full text-xs px-2 py-1.5 border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white mt-1 shadow-sm"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2 border-t border-blue-200 pt-3 mt-auto">
                            <button type="button" onClick={handleCancelEdit} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-white hover:text-gray-700 rounded-lg transition shadow-sm border border-transparent hover:border-gray-200">
                              Cancel
                            </button>
                            <button type="submit" className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm">
                              <Save size={14}/> Save
                            </button>
                          </div>
                        </form>

                      ) : (

                        <div key={dish.id} className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition group flex flex-col justify-between">
                          
                          <div className="flex justify-between items-start mb-3">
                            <div className="pr-4">
                              <span className="font-bold text-gray-800 leading-tight block">{dish.dish_name}</span>
                              
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                <span className={`inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                  dish.diet_type === 'Veg' ? 'bg-green-100 text-green-700' : 
                                  dish.diet_type === 'Common' ? 'bg-blue-100 text-blue-700' : 
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {dish.diet_type}
                                </span>
                                
                                {dish.served_meals && (
                                  <span 
                                    className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] uppercase font-bold px-2 py-0.5 rounded cursor-help"
                                    title={`Currently scheduled for: ${dish.served_meals}`}
                                  >
                                    <Calendar size={10} /> Active Menu
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                              <button 
                                onClick={() => handleEditClick(dish)}
                                className="text-gray-400 hover:bg-blue-50 hover:text-blue-600 p-2 rounded-lg transition"
                                title="Edit dish"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => handleDeleteFromCatalog(dish.id, dish.dish_name)}
                                className="text-gray-400 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg transition"
                                title="Delete dish"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 border-t border-gray-100 pt-3 mt-auto">
                            <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-100" title="Student Popularity Score">
                              <Star size={12} className="fill-current"/> 
                              {dish.popularity_score ? Number(dish.popularity_score).toFixed(1) : 'N/A'}
                            </div>
                            <div className="flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-1 rounded text-xs font-bold border border-gray-200" title="Base Cost">
                              ₹{dish.cost}
                            </div>
                            <div className="flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-1 rounded text-xs font-bold border border-gray-200" title="Kitchen Effort (1-10)">
                              ♨ {dish.effort_score}
                            </div>
                          </div>

                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: THE AI MENU GENERATOR MODAL     */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-purple-100">
            
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
              <BrainCircuit size={48} className="mx-auto mb-3 text-purple-200" />
              <h2 className="text-2xl font-black tracking-tight">AI Menu Architect</h2>
              <p className="text-purple-200 text-sm mt-1 font-medium">Generate a data-driven weekly schedule.</p>
            </div>

            <div className="p-6 space-y-6 bg-gray-50">
              
              <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-sm text-purple-800 leading-relaxed">
                The AI will analyze your <strong>Menu Catalog</strong> (costs, effort scores) and historical <strong>Student Reviews</strong> to build the optimal 7-day schedule.
              </div>
              <button 
                onClick={() => setShowAIGuide(!showAIGuide)}
                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md transition-colors ${showAIGuide ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <Info size={14} /> {showAIGuide ? 'Hide Guide' : 'How does the AI work?'}
              </button>
              
              {showAIGuide && (
                  <div className="mb-4 bg-purple-50/50 border border-purple-100 p-4 rounded-xl animate-slide-down">
                    <div className="flex items-center gap-2 mb-3">
                      <BrainCircuit size={16} className="text-purple-600" />
                      <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Base AI Directives (Already Active)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-4">
                      <div className="flex items-start gap-2">
                        <Leaf size={14} className="shrink-0 mt-0.5 text-green-600" />
                        <span className="text-xs text-gray-700 leading-snug"><b>Dietary Balance:</b> 1+ Veg/Common & 1+ Non-Veg per meal.</span>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Scale size={14} className="shrink-0 mt-0.5 text-orange-500" />
                        <span className="text-xs text-gray-700 leading-snug"><b>Kitchen Load:</b> Balances daily Cost (₹) & Effort (♨).</span>
                      </div>

                      <div className="flex items-start gap-2">
                        <Smile size={14} className="shrink-0 mt-0.5 text-yellow-600" />
                        <span className="text-xs text-gray-700 leading-snug"><b>Student Happiness:</b> Prioritizes top rated (⭐) catalog items.</span>
                      </div>

                      <div className="flex items-start gap-2">
                        <UtensilsCrossed size={14} className="shrink-0 mt-0.5 text-blue-500" />
                        <span className="text-xs text-gray-700 leading-snug"><b>Variety:</b> Prevents exact same meal two days in a row.</span>
                      </div>
                    </div>
                    
                    <div className="bg-white border border-purple-100 px-3 py-2.5 rounded-lg flex gap-2 items-start shadow-sm">
                      <span className="text-xs text-purple-800 leading-snug">
                        <b>💡 Pro Tip:</b> Don't repeat the rules above. Use the prompt below for thematic goals (e.g., <i>"Make Friday dinner expensive," "Only veg on Tuesday"</i>).
                      </span>
                    </div>
                  </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Any specific instructions for the AI? (Optional)
                </label>
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., 'Keep the total budget strictly under ₹2000' or 'Choose only one common item for every day breakfast....'"
                  className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none h-24"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort(); 
                    }
                    setShowAIModal(false); 
                    setAiLoading(false);   
                  }}
                  className="flex-1 bg-white border-2 border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {ask_ai();}}
                  disabled={aiLoading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transition flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {aiLoading ? (
                    <span className="animate-spin text-xl">⚙️</span>
                  ) : (
                    <><Sparkles size={18}/> Generate Now</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ASSIGN DISH TO MENU SCHEDULE     */}
      {assignModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg">Assign to Schedule</h3>
              <button onClick={() => setAssignModalData(null)} className="text-gray-500 hover:text-red-500 font-bold">X</button>
            </div>
            
            <form onSubmit={handleAssignDish} className="p-6 space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded text-sm mb-4 border border-blue-200">
                Scheduling for: <br/>
                <strong>{assignModalData.dateString}</strong> ({assignModalData.mealType})
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select from Catalog</label>
                <select required value={selectedDishId} onChange={(e) => setSelectedDishId(e.target.value)} className="w-full border p-2 rounded outline-none">
                  <option value="">-- Choose a Dish --</option>
                  {catalog.map(dish => (
                    <option key={dish.id} value={dish.id}>
                      {dish.dish_name} ({dish.diet_type})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 transition mt-4">Confirm Assignment</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT MEAL TIMINGS                */}
      {timeEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg">Edit {timeEditModal.meal} Time</h3>
              <button onClick={() => setTimeEditModal(null)} className="text-gray-500 hover:text-red-500 font-bold">X</button>
            </div>
            
            <form onSubmit={handleUpdateTiming} className="p-6 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input 
                    type="time" 
                    required 
                    value={timeEditModal.start} 
                    onChange={(e) => setTimeEditModal({...timeEditModal, start: e.target.value})} 
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input 
                    type="time" 
                    required 
                    value={timeEditModal.end} 
                    onChange={(e) => setTimeEditModal({...timeEditModal, end: e.target.value})} 
                    className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition mt-4">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV UPLOAD GUIDE MODAL */}
      {showUploadGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-600" /> Menu CSV Formatting Rules
              </h2>
              <button onClick={() => setShowUploadGuide(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5 text-sm text-gray-600 max-h-[70vh] overflow-y-auto">
              <p>To successfully upload a weekly menu schedule, your CSV must include the following headers: <b className="text-gray-800">serve_date, meal_type, dish_name, diet_type, cost, effort_score</b>.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Dish Name (Combo Rule)</span>
                  Must be a combo meal! Must contain <b>&</b>, <b>+</b>, or the exact word <b>and</b>.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600">Valid: Rice & Fish Curry</code><br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-red-500">Note: use '+','&','and' to seperate items in a meal</code>
                </div>
                
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Serve Date (serve_date)</span>
                  Must match the standard database date format.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600">Valid: YYYY-MM-DD (e.g., 2026-03-12)</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Meal Type (meal_type)</span>
                  Must be exactly one of the three daily slots.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-gray-800 font-bold">Breakfast, Lunch, Dinner</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Item Limit per Meal</span>
                  You can schedule a maximum of <b>2 items</b> per meal type per day (e.g., 1 Veg + 1 Non-Veg). Extras will be rejected.
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Diet Type (diet_type)</span>
                  Optional fallback. Must be exactly:<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-gray-800 font-bold">Veg, Non-Veg, or Common</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Kitchen Stats</span>
                  <b>cost</b>: A whole number (e.g., 45)<br/>
                  <b>effort_score</b>: A number from 1 to 10.
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <span className="font-bold text-purple-800 block mb-2 flex items-center gap-2"><Sparkles size={16}/> Auto-Catalog Creation</span>
                <p className="text-purple-700">If you include a <code className="bg-white px-1 rounded text-purple-800 font-bold border border-purple-200">dish_name</code> that isn't in your existing catalog, the system will tag it as a <b>NEW RECIPE</b> draft. When you click Publish, it will automatically be minted into your permanent catalog!</p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button onClick={() => setShowUploadGuide(false)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATALOG CSV UPLOAD GUIDE MODAL */}
      {showCatalogUploadGuide && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <HelpCircle size={20} className="text-blue-600" /> Catalog CSV Formatting Rules
              </h2>
              <button onClick={() => setShowCatalogUploadGuide(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"><X size={20}/></button>
            </div>
            
            <div className="p-6 space-y-5 text-sm text-gray-600 max-h-[70vh] overflow-y-auto">
              <p>To bulk-import dishes directly into your master catalog, your CSV must include these exactly spelled headers: <b className="text-gray-800">dish_name, diet_type, cost, effort_score</b>.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Dish Name (Combo Rule)</span>
                  Must be a combo meal! Must contain <b>&</b>, <b>+</b>, or the exact word <b>and</b>.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600">Valid: Rice & Fish Curry</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Diet Type (diet_type)</span>
                  Must be exactly one of the following:<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-gray-800 font-bold">Veg, Non-Veg, Common</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Base Cost (cost)</span>
                  Must be a number indicating the raw cost per plate. Defaults to 0 if left blank.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600">Valid: 45</code>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                  <span className="font-bold text-gray-800 block mb-1">Kitchen Effort (effort_score)</span>
                  A number from 1 to 10 indicating how hard it is to cook. Defaults to 5 if left blank.<br/>
                  <code className="text-xs bg-white px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block text-green-600">Valid: 6</code>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <span className="font-bold text-blue-800 block mb-2 flex items-center gap-2"><CheckCircle size={16}/> Duplicate Prevention</span>
                <p className="text-blue-700">If a dish with the exact same name already exists in your catalog, the system will silently skip it to prevent database errors.</p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button onClick={() => setShowCatalogUploadGuide(false)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MessReviewsTab = () => {
  const [allReviews, setAllReviews] = useState([]);
  const [catalog, setCatalog] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSyncingMath, setIsSyncingMath] = useState(false);

  // AI State
  const [aiSummary, setAiSummary] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);

  // Filters State
  const [filterMeal, setFilterMeal] = useState('All');
  const [filterDiet, setFilterDiet] = useState('All');
  const [filterRating, setFilterRating] = useState('All');
  const [filterDate, setFilterDate] = useState(''); 

  useEffect(() => {
    fetchDashboardData();
  }, []);

const fetchDashboardData = async () => {
    try {
      const [revRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/admin/mess-reviews'),
        axios.get('http://localhost:3001/api/admin/menu-catalog')
      ]);
      setAllReviews(revRes.data);
      setCatalog(catRes.data);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
      toast.error("Failed to fetch dashboard data."); 
    } finally {
      setLoading(false);
    }
  };

  // The Analytics Engine
  const { filteredReviews, stats, topDishes, topBayesian, bottomBayesian } = useMemo(() => {
    // 1. Apply User Filters
    let filtered = allReviews.filter(r => {
      const matchMeal = filterMeal === 'All' || r.meal_type === filterMeal;
      const matchDiet = filterDiet === 'All' || r.diet_type === filterDiet;
      const matchRating = 
        filterRating === 'All' ? true :
        filterRating === 'Critical' ? r.rating <= 2 :
        filterRating === 'Neutral' ? r.rating === 3 :
        r.rating >= 4;
      const reviewDate = r.serve_date ? r.serve_date.split('T')[0] : '';
      const matchDate = filterDate === '' || reviewDate === filterDate;
      return matchMeal && matchDiet && matchRating && matchDate;
    });

    // 2. Calculate Dashboard Stats
    const total = filtered.length;
    const avg = total > 0 ? (filtered.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : 0;
    const critical = filtered.filter(r => r.rating <= 2).length;

    // 3. Extract JSON Issues for Top Complained
    const issueCounts = {};
    filtered.forEach(r => {
      if (r.dish_issues && r.dish_issues !== '{}') {
        try {
          const parsed = typeof r.dish_issues === 'string' ? JSON.parse(r.dish_issues) : r.dish_issues;
          Object.entries(parsed).forEach(([dishName, tags]) => {
            if (!issueCounts[dishName]) issueCounts[dishName] = { count: 0, tags: [] };
            issueCounts[dishName].count += 1;
            issueCounts[dishName].tags.push(...tags);
          });
        } catch (e) {}
      }
    });

    // 4. Calculate Bayesian Leaderboards (from Catalog)
    let applicableCatalog = catalog;
    
    if (filterMeal !== 'All') {
      applicableCatalog = catalog.filter(dish => 
        dish.served_meals && dish.served_meals.includes(filterMeal)
      );
    }

    const sortedCatalog = [...applicableCatalog].sort((a, b) => Number(b.popularity_score) - Number(a.popularity_score));
    
    const topB = sortedCatalog.slice(0, 3);
    const bottomB = sortedCatalog.slice(-3).reverse(); 

    const top = Object.entries(issueCounts)
      .map(([name, data]) => ({ name, count: data.count, tags: [...new Set(data.tags)] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return { 
      filteredReviews: filtered, 
      stats: { total, avg, critical },
      topDishes: top,
      topBayesian: topB,
      bottomBayesian: bottomB
    };
  }, [allReviews, catalog, filterMeal, filterDiet, filterRating, filterDate]);

  const handleGenerateInsights = () => {
    if (filteredReviews.length === 0) {
      toast.error("No reviews to analyze!");
      return;
    }
    setGeneratingAI(true);
    
    toast.promise(
      axios.post('http://localhost:3001/api/admin/generate-insights', {
        reviews: filteredReviews,
        stats: stats
      }),
      {
        loading: 'Gemini is analyzing reviews...',
        success: (res) => {
          setAiSummary(res.data.summary);
          return "Insights generated!";
        },
        error: "Failed to generate AI insights."
      }
    ).finally(() => setGeneratingAI(false));
  };

  const handleForceMathSync = () => {
    setIsSyncingMath(true);
    
    toast.promise(
      axios.get('http://localhost:3001/api/admin/force-popularity-sync'),
      {
        loading: 'Recalculating Bayesian ratings...',
        success: (res) => {
          fetchDashboardData(); // Instantly refresh the leaderboard data!
          return res.data.message || "Math Complete!";
        },
        error: "Failed to run the math engine."
      }
    ).finally(() => setIsSyncingMath(false));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown Date';
    return new Date(dateString.split('T')[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse font-bold">Loading Command Center...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ROW 1: LIVE METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-blue-500 flex items-center justify-between hover:shadow-md transition">
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Average Rating</p>
              <h3 className="text-4xl font-black text-gray-800 flex items-end gap-2">
                {stats.avg} <Star className="text-yellow-400 fill-yellow-400 mb-1" size={28}/>
              </h3>
            </div>
            <TrendingUp size={48} className="text-blue-100" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-gray-800 flex items-center justify-between hover:shadow-md transition">
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Reviews</p>
              <h3 className="text-4xl font-black text-gray-800">{stats.total}</h3>
            </div>
            <MessageSquare size={48} className="text-gray-100" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-red-500 flex items-center justify-between hover:shadow-md transition">
            <div>
              <p className="text-red-500 text-sm font-bold uppercase tracking-wider mb-1">Critical Issues (1-2★)</p>
              <h3 className="text-4xl font-black text-red-600">{stats.critical}</h3>
            </div>
            <AlertOctagon size={48} className="text-red-100" />
          </div>
        </div>

        {/* ROW 2: AI EXECUTIVE SUMMARY */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl shadow-lg p-1 relative overflow-hidden">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-6 h-full flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-shrink-0 text-center md:text-left">
              <div className="bg-purple-100 text-purple-600 p-3 rounded-full inline-block mb-2">
                <Zap size={24} />
              </div>
              <h3 className="font-black text-xl text-gray-800">AI Insights</h3>
              <p className="text-xs text-gray-500 font-medium">Powered by Gemini</p>
            </div>
            
            <div className="flex-grow w-full">
              {aiSummary ? (
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-sm text-purple-900 whitespace-pre-line leading-relaxed font-medium">
                  {aiSummary}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-gray-500 flex items-center justify-center h-full italic">
                  Click generate to analyze the currently filtered reviews.
                </div>
              )}
            </div>

            <div className="flex-shrink-0 w-full md:w-auto">
              <button 
                onClick={handleGenerateInsights}
                disabled={generatingAI}
                className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition disabled:opacity-70"
              >
                {generatingAI ? <span className="animate-pulse">Analyzing...</span> : <><Sparkles size={18} /> Generate</>}
              </button>
            </div>
          </div>
        </div>

        {/* ROW 3: LEADERBOARDS & FILTERS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COL 1: The Bayesian Leaderboard */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col gap-4">
            
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                <Star size={18} className="text-yellow-500"/> Meal Rankings
              </h3>
              
              <button 
                onClick={handleForceMathSync} 
                disabled={isSyncingMath}
                className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 px-2 py-1 rounded text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-70 shadow-sm"
              >
                {isSyncingMath ? (
                  <>
                    <span className="animate-spin text-[10px]">⚙️</span> Syncing...
                  </>
                ) : (
                  <>
                    <span className="text-[10px]">🧮</span> Sync
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 mb-1">🔥 ALL-TIME BEST</p>
              {topBayesian.map((dish, i) => (
                <div key={i} className="flex justify-between items-center bg-green-50 p-2 rounded-lg border border-green-100">
                  <span className="text-sm font-bold text-green-800 line-clamp-1 flex gap-2"><ThumbsUp size={14} className="mt-0.5"/> {dish.dish_name}</span>
                  <span className="bg-green-200 text-green-800 text-xs font-black px-2 py-1 rounded">{Number(dish.popularity_score).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 mt-2">
              <p className="text-xs font-bold text-gray-400 mb-1">⚠️ ALL-TIME WORST</p>
              {bottomBayesian.map((dish, i) => (
                <div key={i} className="flex justify-between items-center bg-red-50 p-2 rounded-lg border border-red-100">
                  <span className="text-sm font-bold text-red-800 line-clamp-1 flex gap-2"><ThumbsDown size={14} className="mt-0.5"/> {dish.dish_name}</span>
                  <span className="bg-red-200 text-red-800 text-xs font-black px-2 py-1 rounded">{Number(dish.popularity_score).toFixed(2)}</span>
                </div>
              ))}
            </div>
            
            
          </div>

          {/* COL 2: Top Complained */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider mb-4">
              <AlertOctagon size={18} className="text-orange-500"/> High Alert (Current Filter)
            </h3>
            {topDishes.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400 italic bg-gray-50 rounded-xl border border-gray-100">No active complaints.</div>
            ) : (
              <div className="space-y-3">
                {topDishes.map((dish, i) => (
                  <div key={i} className="bg-orange-50 border border-orange-100 p-3 rounded-xl">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-orange-800 text-sm">{dish.name}</span>
                      <span className="bg-orange-200 text-orange-800 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">{dish.count} flags</span>
                    </div>
                    <p className="text-xs text-orange-600 line-clamp-1 font-medium">{dish.tags.join(', ')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COL 3: Triage Filters */}
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col justify-center">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Filter size={18} className="text-blue-500"/> Filters
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Date</label>
                <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full text-sm bg-gray-50 border border-gray-200 py-2 px-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Meal</label>
                <select value={filterMeal} onChange={(e) => setFilterMeal(e.target.value)} className="w-full text-sm bg-gray-50 border border-gray-200 py-2 px-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="All">All Meals</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Diet</label>
                <select value={filterDiet} onChange={(e) => setFilterDiet(e.target.value)} className="w-full text-sm bg-gray-50 border border-gray-200 py-2 px-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="All">All Diets</option>
                  <option value="Veg">Vegetarian</option>
                  <option value="Non-Veg">Non-Veg</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Rating</label>
                <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)} className="w-full text-sm bg-gray-50 border border-gray-200 py-2 px-2 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="All">All</option>
                  <option value="Critical">1-2★ (Critical)</option>
                  <option value="Neutral">3★ (Neutral)</option>
                  <option value="Positive">4-5★ (Positive)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 4: REVIEW FEED */}
        <div>
          <h3 className="font-bold text-gray-800 mb-4 text-xl">Review Logs ({filteredReviews.length})</h3>
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-500 border border-gray-100 font-medium">No reviews match your current filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredReviews.map((review) => (
                <div key={review.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-100 hover:shadow-md transition relative ${review.rating <= 2 ? 'ring-2 ring-red-400/50' : review.rating === 3 ? 'border-t-4 border-t-yellow-400' : 'border-t-4 border-t-green-400'}`}>
                  
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-start">
                    <div className="pr-2">
                      <h4 className="font-bold text-gray-800">{review.meal_type}</h4>
                      
                      <p className="text-xs font-bold text-blue-600 mt-0.5 mb-1.5 leading-tight">
                        🍽️ {review.served_dishes || "Menu data unavailable"}
                      </p>
                      
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        {formatDate(review.serve_date)} • <span className="bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Anonymous</span>
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shrink-0 ${review.diet_type === 'Veg' ? 'bg-green-100 text-green-700' : review.diet_type === 'Common' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{review.diet_type}</span>
                  </div>

                  <div className="p-5 flex-grow flex flex-col gap-4">
                    <div className="flex gap-1 text-xl">
                      {[1, 2, 3, 4, 5].map(star => (<span key={star} className={review.rating >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>))}
                    </div>

                    {(() => {
                      if (!review.dish_issues) return null;
                      try {
                        const parsed = typeof review.dish_issues === 'string' ? JSON.parse(review.dish_issues) : review.dish_issues;
                        if (Object.keys(parsed).length === 0) return null;
                        return (
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                            <p className="text-[10px] font-black text-red-800 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertOctagon size={12}/> Flagged</p>
                            <ul className="space-y-1">
                              {Object.entries(parsed).map(([dishName, tags]) => (
                                <li key={dishName} className="text-sm leading-tight"><span className="font-bold text-gray-800">{dishName}:</span> <span className="text-gray-600">{tags.join(', ')}</span></li>
                              ))}
                            </ul>
                          </div>
                        );
                      } catch (e) { return null; }
                    })()}

                    {review.comment && (
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 relative mt-auto">
                        <MessageSquare size={14} className="absolute top-3 left-3 text-gray-300" />
                        <p className="text-sm text-gray-600 italic pl-6 font-medium">"{review.comment}"</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Main layout
function WardenDashboard() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('wardenActiveTab') || 'home';
  });

  useEffect(() => {
    localStorage.setItem('wardenActiveTab', activeTab);
  }, [activeTab]);  
  // Sidebar 
  const menuItems = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'mess', label: 'Mess Reviews', icon: <ClipboardList size={20} /> },
    { id: 'menu', label: 'Menu Management', icon: <Utensils size={20} /> },
    { id: 'overnight', label: 'Overnight Logs', icon: <Moon size={20} /> },
    { id: 'grievances', label: 'Grievances', icon: <AlertCircle size={20} /> },
    { id: 'students', label: 'Student Management', icon: <Users size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">W</div>
          <div>
            <h2 className="font-bold text-gray-800 leading-tight">Warden Panel</h2>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* <div className="p-4 border-t border-gray-100 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-gray-600 text-sm font-medium">
            <Settings size={20} /> Settings
          </button>
          <button 
             onClick={() => window.location.href = "/"}
             className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div> */}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 ml-64 p-8">
        {activeTab === 'overnight' && <OvernightLogTab />}
        {activeTab === 'mess' && <MessReviewsTab />}
        {activeTab === 'menu' && <MenuTab />}
        {activeTab === 'home' && <DashboardHome setActiveTab={setActiveTab}/>}
        {activeTab === 'grievances' && <GrievancesTab />}
        {activeTab === 'students' && <StudentMgmtTab />}
      </main>

    </div>
  );
}

export default WardenDashboard;