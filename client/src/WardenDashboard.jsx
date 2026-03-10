import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Home,Star,Clock,RefreshCw,Trash2,Search, CheckCircle, ClipboardList, Utensils, Moon, AlertCircle, Users, Settings, LogOut, 
  Filter, ListFilter, X, FileVideo, Phone, Calendar, Shield, Edit2, Save, ChevronRight,TrendingDown, AlertOctagon, MessageSquare, Plus, Sparkles, BrainCircuit, Image as ImageIcon,
  TrendingUp, ThumbsUp, ThumbsDown, Zap
} from 'lucide-react';

// --- SUB-COMPONENTS  ---

const OvernightLogTab= () => {
  const [stats, setStats] = useState({ out_now: 0, total_students: 50 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [outStudents, setOutStudents] = useState([]);
  const [showOutModal, setShowOutModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [absentSearch, setAbsentSearch] = useState('');
  const [gateSearch, setGateSearch] = useState('');
  const [gateFilter, setGateFilter] = useState('All');
  // Initial Data Fetch (Only for Home Tab)
  useEffect(() => {
    fetchOvernightLogData();
    const interval = setInterval(fetchOvernightLogData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchOvernightLogData = () => {
    // Replace IP with your backend IP
    setLoading(true);
    axios.get('http://localhost:3001/api/warden/overnightlog') 
      .then(res => {
        setStats(res.data.stats);
        setRecentLogs(res.data.recent_logs);
      })
      .catch(err => console.error("Dashboard fetch error", err))
      .finally(setLoading(false));
  };

  const handleOutClick = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/warden/out-list');
      setOutStudents(res.data);
      setShowOutModal(true);
    } catch (err) {
      alert("Failed to fetch data");
    }
  };
  
  const handleReset = async () => {
    if (!window.confirm(" ARE YOU SURE? This will delete ALL logs and mark everyone as Present.")) {
      return;
    }

    try {
      await axios.post('http://localhost:3001/api/warden/reset');
      alert("System Reset Successfully!");
      fetchOvernightLogData(); 
    } catch (err) {
      alert("Failed to reset system");
    }
  };

  const checkinOverride = async (uid) =>{
      if (!window.confirm(`Confirm Override check-in for uid ${uid}?`)) {
        return;
      }
      setLoading(true);
      try{
        const res= await axios.post("http://localhost:3001/api/warden/checkinOverride",{
          student_id: uid,
          action: 'returned',
          reason: 'Returned via Overridden check-in',
          destination: 'Hostel',
        })
        if (res.data.success) {
            setOutStudents(prev => prev.filter(student => student.uid !== uid));
            fetchOvernightLogData();
      }
      }catch (err) {
       if (err) {
         console.error("Server Error:", err.response.data);
         alert(`System Error: ${JSON.stringify(err.response.data)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  // FILTER OUT STUDENTS
  const filteredOutStudents = outStudents.filter(s => {
      const term = absentSearch.toLowerCase();
      // Search by Name OR UID
      return s.full_name.toLowerCase().includes(term) || s.uid.toLowerCase().includes(term);
  });

  // FILTER GATE LOGS 
  const filteredRecentLogs = recentLogs.filter(log => {
      const term = gateSearch.toLowerCase();
      
      // 1. Search Text (Name or UID)
      const matchText = log.full_name.toLowerCase().includes(term) || log.uid.toLowerCase().includes(term);

      // 2. Dropdown Filter (Status/Type)
      const matchFilter = gateFilter === 'All' 
        ? true 
        : (gateFilter === 'Checked Out' ? log.status === 'out' : log.status === 'returned');

      return matchText && matchFilter;
  });
  
  return (
  <div className="animate-fade-in">
    <h1 className="text-2xl font-bold text-gray-800 mb-6">Overnight Logs</h1>
    
    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div 
        onClick={handleOutClick} 
        className="bg-red-50 p-6 rounded-2xl border border-red-100 cursor-pointer hover:shadow-lg transition-all"
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-500 font-medium mb-1">Students Out</p>
            <h3 className="text-4xl font-bold text-red-600">{stats.out_now}</h3>
          </div>
          <div className="p-3 bg-red-100 rounded-xl text-red-600"><LogOut size={24}/></div>
        </div>
        <p className="text-xs text-red-400 mt-4 font-medium">Click to view list &rarr;</p>
      </div>

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-gray-500 font-medium mb-1">Total Students</p>
            <h3 className="text-4xl font-bold text-blue-600">{stats.total_students}</h3>
          </div>
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Users size={24}/></div>
        </div>
      </div>

      <div className="flex gap-3 m-10 mb-10">
        <button 
          onClick={handleReset}
          className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition text-sm"
        >
          Reset Log
        </button>
        <button onClick={fetchOvernightLogData} className="p-2 bg-white rounded-full shadow-sm hover:shadow-md transition">
          <RefreshCw size={20} className={`text-blue-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>

    {/* Recent Logs Table */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex justify-between items-center">
        <h3 className="font-bold text-gray-800">Recent Gate Activity</h3>
      </div>
      {/* SEARCH INPUT */}
      <div className='flex flex-row pl-6'>
        <div className="relative w-full md:w-auto">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
                type="text" 
                placeholder="Search Log..." 
                value={gateSearch}
                onChange={(e) => setGateSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
        </div>
        {/* STATUS FILTER */}
        <div className="ml-2 relative flex">
            <Filter size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <select 
                value={gateFilter}
                onChange={(e) => setGateFilter(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer appearance-none"
            >
                <option value="All">All Activity</option>
                <option value="Checked In">Returned</option>
                <option value="Checked Out">Out</option>
            </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
            <tr>
              <th className="px-6 py-4">Student</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Destination/Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRecentLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <p className="font-bold text-gray-800">{log.full_name || "Unknown"}</p>
                  <p className="text-xs text-gray-400">{log.uid}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    log.status === 'out' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {log.status === 'out' ? 'OUT' : 'RETURNED'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                      <Clock size={14} />
                      {new Date(log.exit_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(log.exit_time).toLocaleDateString()}
                    </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  <p className="text-sm font-medium text-gray-800">{log.destination || 'N/A'}</p>
                  <p className="text-xs text-gray-500 truncate max-w-[150px]">{log.reason}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Students Out Modal */}
    {showOutModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
          <div className="bg-red-600 p-4 flex justify-between items-center text-white">
            <h3 className="font-bold text-lg">⚠️ Absent Students</h3>
            <div className="relative w-full md:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search Absent Student..." 
                    value={absentSearch}
                    onChange={(e) => setAbsentSearch(e.target.value)}
                    className="text-black w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 transition"
                />
            </div>
            <button onClick={() => setShowOutModal(false)} className="hover:bg-red-700 p-1 rounded-full transition">✕</button>
          </div>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {outStudents.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No students are currently out.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-xs text-gray-400 uppercase">
                    <th className="p-2">Name</th>
                    <th className="p-2">UID</th>
                    <th className="p-2">Phone No.</th>
                    <th className="p-2">Home Address</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOutStudents.map((student) => (
                    <tr key={student.uid} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-2 font-medium text-gray-800">{student.full_name}</td>
                      <td className="p-3 text-sm text-gray-500">{student.uid}</td>
                      <td className="p-3 text-sm text-gray-500">{student.phone_no}</td>
                      <td className="p-3 text-sm text-gray-500">{student.address}</td>
                      <td className="p-3 text-sm text-gray-500"><button className="w-full bg-green-600 rounded-xl text-white active:scale-95" onClick={() => checkinOverride(student.uid)}>check-in</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
  </div>)
  };

const GrievancesTab = () => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'history'
  const [filterCategory, setFilterCategory] = useState('All'); 
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [evidenceModal, setEvidenceModal] = useState(null);

  useEffect(() => {
    fetchGrievances();
    const interval = setInterval(fetchGrievances, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchGrievances = () => {
    setLoading(true);
    axios.get('http://localhost:3001/api/warden/grievances')
      .then(res => setGrievances(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const handleStatusUpdate = async (id, newStatus) => {
    if (newStatus === 'Resolved') {
      if (!window.confirm("Are you sure you want to mark this issue as Resolved? It will be moved to History.")) {
        return; 
      }
    }
    const updatedList = grievances.map(g => 
      g.id === id ? { ...g, status: newStatus } : g
    );
    setGrievances(updatedList);

    try {
      await axios.put(`http://localhost:3001/api/warden/grievances/${id}`, { status: newStatus });
      if (newStatus === 'Resolved') fetchGrievances(); // Refresh to get server timestamp
    } catch (err) {
      alert("Failed to update status");
      fetchGrievances(); 
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Delete this specific record permanently?")) return;

    try {
      await axios.delete(`http://localhost:3001/api/warden/grievances/${id}`);
      setGrievances(grievances.filter(g => g.id !== id)); 
    } catch (err) {
      alert("Failed to delete record");
    }
  };

  const handleClearHistory = async () => {
    if(!window.confirm("⚠️ WARNING: This will permanently delete ALL resolved complaints. This cannot be undone.")) return;

    try {
      await axios.delete('http://localhost:3001/api/warden/grievances/clear-history');
      setGrievances(grievances.filter(g => g.status !== 'Resolved'));
      alert("History Cleared Successfully");
    } catch (err) {
      alert("Failed to clear history");
    }
  };

  
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
        const matchUid = g.uid.toLowerCase().includes(lowerTerm);
        const matchName = g.full_name ? g.full_name.toLowerCase().includes(lowerTerm) : false;
        if (!matchUid && !matchName) return false;
    }
    return true;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'Pending': return 'bg-red-50 text-red-600 border-red-100';
      case 'Assigned': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Resolved': return 'bg-green-50 text-green-600 border-green-100';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  // --- EVIDENCE MODAL COMPONENT ---
  const EvidenceModal = () => {
    if (!evidenceModal) return null;

    const isVideo = evidenceModal.endsWith('.mp4') || evidenceModal.endsWith('.webm');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="relative bg-white rounded-2xl overflow-hidden max-w-3xl w-full shadow-2xl">
          
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-700">Evidence Review</h3>
            <button 
              onClick={() => setEvidenceModal(null)}
              className="p-2 bg-white rounded-full hover:bg-gray-200 transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-0 bg-black flex justify-center items-center min-h-[300px]">
            {isVideo ? (
              <video 
                src={`http://localhost:3001${evidenceModal}`} 
                controls 
                autoPlay 
                className="max-h-[60vh] w-full"
              />
            ) : (
              <img 
                src={`http://localhost:3001${evidenceModal}`} 
                alt="Evidence" 
                className="max-h-[60vh] object-contain"
              />
            )}
          </div>
          
          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
            <a 
              href={`http://localhost:3001${evidenceModal}`} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Open Original File
            </a>
          </div>
        </div>
      </div>
    );
  };
 //Resolve all
  const handleResolveAll = async () => {
    // 1. Get only the Unresolved items from the current filtered view
    const itemsToResolve = filteredGrievances.filter(g => g.status !== 'Resolved');

    if (itemsToResolve.length === 0) return;

    // 2. Confirmation
    const confirmMsg = `Are you sure you want to mark ${itemsToResolve.length} complaints as RESOLVED? \n\nThis will remove them from the active list and DELETE any attached evidence.`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);

    try {
      // 3. Process all updates in parallel
      // We map each item to an axios PUT request
      await Promise.all(itemsToResolve.map(g => 
        axios.put(`http://localhost:3001/api/warden/grievances/${g.id}`, { status: 'Resolved' })
      ));

      // 4. Success & Refresh
      alert(`Successfully resolved ${itemsToResolve.length} complaints.`);
      fetchGrievances(); // Refresh list to update UI
    } catch (err) {
      console.error(err);
      alert("Some requests failed. Please refresh and try again.");
      fetchGrievances();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <EvidenceModal />
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grievances</h1>
          <p className="text-sm text-gray-500">
            {viewMode === 'active' ? 'Pending Complaints' : 'Resolved history'}
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative flex-1 md:flex-none">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input 
              type="text"
              placeholder="Search UID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full md:w-48 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          {viewMode === 'active' && (
            <div className="relative">
              <ListFilter size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer appearance-none"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
              </select>
            </div>
          )}
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer appearance-none"
            >
              <option value="All">All Categories</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Furniture">Furniture</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {/* --- NEW: RESOLVE ALL BUTTON --- */}
          {viewMode === 'active' && filteredGrievances.length > 0 && (
            <button 
              onClick={handleResolveAll}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-green-700 active:scale-95 transition"
              title="Resolve all currently visible complaints"
            >
              <CheckCircle size={16} /> 
              <span className="hidden md:inline">Resolve All ({filteredGrievances.length})</span>
            </button>
          )}
          {viewMode === 'history' && filteredGrievances.length > 0 && (
             <button 
               onClick={handleClearHistory}
               className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-bold hover:bg-red-100 transition"
             >
               <LogOut size={16} /> Clear All History
             </button>
          )}

          <div className="bg-gray-100 p-1 rounded-xl flex h-fit">
            <button 
              onClick={() => setViewMode('active')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'active' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active
            </button>
            <button 
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'history' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredGrievances.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 border-dashed">
            <p className="text-gray-400 font-medium">No {viewMode} grievances found.</p>
          </div>
        ) : (
          filteredGrievances.map((g) => (
            <div key={g.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition">
              
              {/* User Info */}
              <div className="flex gap-4 min-w-[200px]">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl">
                  {g.full_name ? g.full_name.charAt(0) : '?'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{g.full_name || "Unknown"}</h3>
                  <p className="text-xs text-gray-400">{g.uid}</p>
                  <p className="text-xs text-gray-500 mt-1">Room: <span className="font-semibold">{g.room_no}</span></p>
                </div>
              </div>

              {/* Complaint Content */}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                     <span className="text-xs font-bold text-gray-400 uppercase">Description</span>
                     <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md border border-gray-200">
                        {g.category}
                     </span>
                  </div>
                  
                  {viewMode === 'active' ? (
                    <select 
                      value={g.status}
                      onChange={(e) => handleStatusUpdate(g.id, e.target.value)}
                      className={`text-xs px-3 py-1 rounded-full font-bold border outline-none cursor-pointer ${getStatusColor(g.status)}`}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  ) : (
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600 border border-green-100">
                        Resolved
                        </span>
                        <button 
                            onClick={() => handleDelete(g.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                            title="Delete This Record"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                  )}
                </div>
                
                <p className="text-gray-700 text-sm mb-4 leading-relaxed">{g.description}</p>
                
                <div className="flex gap-8 items-end border-t border-gray-50 pt-4 mt-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Logged On</p>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock size={14} className="text-gray-400"/>
                      <span className="text-sm font-medium">
                        {new Date(g.date_logged).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Resolved Date */}
                  {viewMode === 'history' && g.date_resolved && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-green-600 mb-1">Resolved On</p>
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle size={14} />
                        <span className="text-sm font-bold">
                          {new Date(g.date_resolved).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                          {new Date(g.date_resolved).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Evidence Icon */}
                  <div className="ml-auto">
                    {g.img_url ? (
                      <button 
                        onClick={() => setEvidenceModal(g.img_url)}
                        className="w-10 h-10 bg-blue-50 hover:bg-blue-100 text-blue-500 rounded-lg border border-blue-200 flex items-center justify-center transition-all"
                        title="View Evidence"
                      >
                        {g.img_url.endsWith('.mp4') ? <FileVideo size={18} /> : <ImageIcon size={18} />}
                      </button>
                    ) : (
                      <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center text-gray-300 cursor-not-allowed" title="No Evidence">
                        <ImageIcon size={18} />
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
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit State
  const [editingId, setEditingId] = useState(null); // ID of student being edited
  const [editForm, setEditForm] = useState({}); // Temp data while editing

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

  const startEdit = (student) => {
    setEditingId(student.uid);
    setEditForm({ ...student });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    try {
      await axios.put(`http://localhost:3001/api/warden/students/${editingId}`, editForm);
      
      // Update local list without re-fetching
      setStudents(students.map(s => s.uid === editingId ? { ...editForm, checkout_count: s.checkout_count } : s));
      setEditingId(null);
      alert("Student Details Updated");
    } catch (err) {
      alert("Failed to update details");
    }
  };

const formatDOB = (dob) => {
  if (!dob) return "N/A";

  if (dob.length === 8 && !isNaN(dob)) {
    return `${dob.slice(0, 2)}/${dob.slice(2, 4)}/${dob.slice(4)}`;
  }
  return "check dob format"; 
};
  // --- FILTER LOGIC ---
  const filteredStudents = students.filter(s => {
    const term = searchTerm.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(term) ||
      s.uid?.toLowerCase().includes(term) ||
      s.room_no?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="animate-fade-in p-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Student Registry</h1>
          <p className="text-sm text-gray-500">Manage {students.length} residents</p>
        </div>

        {/* SEARCH */}
        <div className="relative w-full md:w-72">
           <Search size={18} className="absolute left-3 top-3 text-gray-400" />
           <input 
             type="text" 
             placeholder="Search Name, UID, Room..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 transition shadow-sm"
           />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
              <tr>
                <th className="px-6 py-4">Student Profile</th>
                <th className="px-6 py-4">Room & Address</th>
                <th className="px-6 py-4">Activity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {filteredStudents.map((s) => (
                <tr key={s.uid} className={`transition ${editingId === s.uid ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                  
                  {/* COL 1: IDENTITY */}
                  <td className="px-6 py-4">
                    {editingId === s.uid ? (
                        <div className="space-y-2">
                            <input 
                              value={editForm.full_name} 
                              onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                              className="w-full p-1 border rounded text-sm font-bold"
                            />
                            <input 
                              value={editForm.phone_no} 
                              onChange={(e) => setEditForm({...editForm, phone_no: e.target.value})}
                              className="w-full p-1 border rounded text-xs"
                              placeholder="Phone"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold text-lg">
                            {s.full_name ? s.full_name.charAt(0) : '?'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">{s.full_name}</p>
                            <p className="text-xs text-gray-400 font-mono">{s.uid}</p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                               <Phone size={10} /> {s.phone_no || "No Phone"}
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
                              className="w-24 p-1 border rounded text-sm font-bold"
                              placeholder="Room"
                            />
                            <textarea 
                              value={editForm.address || ''} 
                              onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                              className="w-full p-1 border rounded text-xs"
                              rows={2}
                              placeholder="Address"
                            />
                        </div>
                    ) : (
                        <div>
                           <div className="flex items-center gap-2 mb-1">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                {s.room_no || "Unassigned"}
                              </span>
                           </div>
                           <p className="text-xs text-gray-500 truncate max-w-[200px]" title={s.address}>
                             {s.address || "No Address Provided"}
                           </p>
                           {/* Using Password Hash as DOB holder*/}
                           <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                             <Calendar size={10}/> DOB: {formatDOB(s.dob)}
                           </p>
                        </div>
                    )}
                  </td>

                  {/* COL 3: STATS */}
                  <td className="px-6 py-4">
                     <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Gate Activity</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold w-fit ${s.checkout_count > 10 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                           <Shield size={12} /> {s.checkout_count || 0} Exits
                        </span>
                     </div>
                  </td>

                  {/* COL 4: ACTIONS */}
                  <td className="px-6 py-4 text-right">
                    {editingId === s.uid ? (
                        <div className="flex justify-end gap-2">
                            <button onClick={saveEdit} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200" title="Save">
                                <Save size={16} />
                            </button>
                            <button onClick={cancelEdit} className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="Cancel">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <button onClick={() => startEdit(s)} className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition">
                           <Edit2 size={16} />
                        </button>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-gray-400">No students found matching "{searchTerm}"</div>
          )}
        </div>
      </div>
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

const MenuTab = () =>{
    // --- STATE ---
  const [weeklyMenu, setWeeklyMenu] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
// Change the dummy data to empty 24-hour formats
  const [mealTimings, setMealTimings] = useState({
    Breakfast: { start: '00:00', end: '00:00' },
    Lunch: { start: '00:00', end: '00:00' },
    Dinner: { start: '00:00', end: '00:00' }
  });
  
  // Add a new state for the Time Editor Modal
  const [timeEditModal, setTimeEditModal] = useState(null); // Will hold { meal: 'Breakfast', start: '07:30', end: '09:30' }
  
  // --- MODAL STATES ---
  const [ShowCatalogModal, setShowCatalogModal] = useState(false);
  const [assignModalData, setAssignModalData] = useState(null); // Will hold { dateString, mealType } when a grid slot is clicked
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // --- FORM STATES ---
  const [newDish, setNewDish] = useState({ dish_name: '', diet_type: 'Veg', cost: '', effort_score: '' });
  const [selectedDishId, setSelectedDishId] = useState('');

  // --- HANDLERS ---
  const handleAddDish = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3001/api/admin/menu-catalog', newDish);
      setShowCatalogModal(false);
      setNewDish({ dish_name: '', diet_type: 'Veg', cost: '', effort_score: '' }); // Reset form
      fetchCatalog(); // Refresh the catalog so the new dish is instantly available
    } catch (err) {
      console.error("Error adding dish:", err);
      alert("Failed to add dish, It may already exist in catalog");
    }
  };

  const handleDeleteFromCatalog = async (dishId, dishName) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${dishName}" from the catalog?`)) return;

    try {
      await axios.delete(`http://localhost:3001/api/admin/menu-catalog/${dishId}`);
      alert(`${dishName} deleted successfully.`);
      fetchCatalog(); // Refresh the list!
    } catch (err) {
      if (err.response && err.response.status === 409) {
        alert(err.response.data.error); // Show the safety warning!
      } else {
        alert("Failed to delete dish.");
      }
    }
  };

  const handleAssignDish = async (e) => {
    e.preventDefault();
    if (!selectedDishId) return alert("Please select a dish!");
    
    try {
      await axios.post('http://localhost:3001/api/admin/daily-menu', {
        serve_date: assignModalData.dateString,
        meal_type: assignModalData.mealType,
        dish_id: selectedDishId
      });
      setAssignModalData(null); // Close the modal
      setSelectedDishId(''); // Reset selection
      fetchWeeklyMenu(); // Instantly refresh the grid to show the new assignment
    } catch (err) {
      console.error("Error scheduling dish:", err);
      alert("Failed to schedule dish.");
    }
  };

  const handleRemoveDish = async (scheduleId, dishName) => {
    // A quick confirmation so they don't accidentally click it
    if (!window.confirm(`Are you sure you want to remove ${dishName} from this slot?`)) return;

    try {
      await axios.delete(`http://localhost:3001/api/admin/daily-menu/${scheduleId}`);
      fetchWeeklyMenu(); // Instantly refresh the grid to show it's gone
    } catch (err) {
      console.error("Error removing dish:", err);
      alert("Failed to remove dish.");
    }
  };

  const handleApproveWeek = async () => {
    // We already have the dates calculated in your weekDays array!
    const startStr = weekDays[0].dateString;
    const endStr = weekDays[6].dateString;

    if (!window.confirm("Are you sure you want to approve this week's menu? This will make it visible to students.")) return;

    try {
      await axios.put('http://localhost:3001/api/admin/daily-menu/approve', {
        start_date: startStr,
        end_date: endStr
      });
      alert("Week's menu approved successfully!");
      fetchWeeklyMenu(); // Refresh the grid
    } catch (err) {
      console.error("Error approving menu:", err);
      alert("Failed to approve menu.");
    }
  };
  // Track the start of the currently viewed week (Defaults to this week's Monday)
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  });

  // Get "Today" formatted exactly like the database (YYYY-MM-DD)
  // For example, today will format as "2026-03-02"
  const todayString = new Date().toLocaleDateString('en-CA');

  // --- HELPER: GENERATE THE 7 DAYS ---
  // This creates an array of 7 objects for the grid rows based on weekStart
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
      dateString: date.toLocaleDateString('en-CA') // YYYY-MM-DD
    };
  });

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchCatalog();
    fetchWeeklyMenu();
    fetchTimings();
  }, [weekStart]); // Re-fetch if the Warden clicks to the next/prev week

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

  // Helper to find a specific dish in our fetched data
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
      fetchTimings(); // Refresh the headers to show the new times
      setTimeEditModal(null); // Close modal
    } catch (err) {
      console.error("Error updating time:", err);
      alert("Failed to update timing.");
    }
  };

  const ask_ai=async () => {
    setAiLoading(true);
    try {
          const res = await axios.post('http://localhost:3001/api/admin/ai-generate-menu', {
          start_date: weekDays[0].dateString,
          end_date: weekDays[6].dateString, 
          custom_prompt: aiPrompt
          });       
          console.log("AI Generated Menu:", res.data.proposed_menu);   
          // Here you would map the res.data.proposed_menu into your UI grid!
          alert("Menu generated! Check the console to see the JSON data.");   
          setShowAIModal(false);
        } catch (err) {
            alert(err.response?.data?.error || "AI Generation Failed");
            } finally {
                setAiLoading(false);
              }
      }

  // Helper to make 24hr time look nice in the table header (e.g., 14:30 -> 2:30 PM)
  const format12Hour = (time24) => {
    if (!time24 || time24 === '00:00') return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${m} ${suffix}`;
  };

  const filteredCatalog = catalog.filter(dish => 
    dish.dish_name.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-800 text-white">
          <h2 className="text-2xl font-bold">Weekly Menu Planner</h2>
          {/* THE AI BUTTON */}
          <button 
            onClick={() => setShowAIModal(true)}
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:shadow-lg hover:scale-105 transition-all active:scale-95 border border-purple-400/50"
          >
            <Sparkles size={18} className="animate-pulse" />
            AI Auto-Schedule
          </button>
          <button className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded shadow transition" onClick={() => setShowCatalogModal(true)}>
            + Manage Catalog
          </button>
        </div>

        {/* THE GRID */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase text-sm">
                <th className="p-4 border-b w-1/4">Day / Date</th>
                
                {/* Dynamically Map the Meal Headers to include times */}
                {['Breakfast', 'Lunch', 'Dinner'].map((meal) => (
                  <th key={meal} className="p-4 border-b w-1/4 group relative">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-base font-bold">{meal}</span>
                        {/* Use the new formatter here! */}
                        <span className="text-xs text-gray-500 font-normal lowercase tracking-wide">
                          {format12Hour(mealTimings[meal].start)} - {format12Hour(mealTimings[meal].end)}
                        </span>
                      </div>
                      
                      {/* Make the button actually open the modal */}
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
                    // Dynamic Tailwind: Blue tint and thick border if it's today!
                    className={`transition-colors ${isToday ? "bg-blue-50 border-l-4 border-blue-500 shadow-sm" : "hover:bg-gray-50 border-b"}`}
                  >
                    {/* Column 1: Date */}
                    <td className="p-4 border-r">
                      <div className={`font-bold text-lg ${isToday ? "text-blue-700" : "text-gray-800"}`}>
                        {day.dayName} {isToday && <span className="text-sm font-normal bg-blue-200 text-blue-800 px-2 py-0.5 rounded ml-2">Today</span>}
                      </div>
                      <div className="text-sm text-gray-500">{day.dateString}</div>
                    </td>

                    {/* Columns 2, 3, 4: Meals */}
                    {['Breakfast', 'Lunch', 'Dinner'].map((meal) => {
                     const assignedDishes = getDishesForSlot(day.dateString, meal);
                      
                      return (
                        <td key={meal} className="p-4 border-r align-top">
                          <div className="flex flex-col gap-2 h-full">
                            
                            {/* Render EVERY dish assigned to this slot */}
                            {assignedDishes.map((dish) => (
                              <div key={dish.schedule_id} className={`p-2 rounded border text-sm relative group pr-6 ${
                                   dish.diet_type === 'Veg' ? 'bg-green-100 text-green-700' : 
                                   dish.diet_type === 'Common' ? 'bg-blue-100 text-blue-700' : 
                                   'bg-red-100 text-red-700'
                                }`}>
                                
                                <span className="font-semibold block">{dish.dish_name}</span>
                                
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs opacity-75">{dish.diet_type}</span>
                                  
                                  {/* THE NEW STATUS BADGE */}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${dish.status === 'Approved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-200 text-yellow-800'}`}>
                                    {dish.status || 'Pending'}
                                  </span>
                                </div>
                                
                                {/* The Delete Button */}
                                <button 
                                  onClick={() => handleRemoveDish(dish.schedule_id, dish.dish_name)}
                                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                                  title="Remove from schedule"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            {/* Always keep the Assign button visible so they can add a 2nd or 3rd dish */}
                            <button 
                              onClick={() => setAssignModalData({ dateString: day.dateString, mealType: meal })}
                              className={`w-full border-2 border-dashed border-gray-300 rounded text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center ${assignedDishes.length > 0 ? 'py-1 text-xs mt-auto' : 'h-full min-h-[60px]'}`}
                            >
                              + {assignedDishes.length > 0 ? 'Add Option' : 'Assign'}
                            </button>
                            
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
        {/* ========================================= */}
      {/* MODAL 1: ADD TO CATALOG                   */}
      {/* ========================================= */}
      {ShowCatalogModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
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
              
              {/* SECTION 1: ADD NEW DISH FORM */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-600 p-1 rounded">+</span> Add New Dish
                </h3>
                <form onSubmit={handleAddDish} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  
                  {/* Row 1: Dish Name (Takes up 2 columns) & Diet Type (Takes 1) */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Dish Name</label>
                    <input 
                      type="text" required
                      value={newDish.dish_name} 
                      onChange={(e) => setNewDish({...newDish, dish_name: e.target.value})}
                      placeholder="e.g. Kadala Curry" 
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

                  {/* Row 2: Base Cost, Effort Score, and Submit Button */}
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
                      Save Dish
                    </button>
                  </div>
                  
                </form>
              </div>

              {/* SECTION 2: CURRENT CATALOG LIST */}
              <div>
                <div className="flex justify-between items-end mb-4 gap-4">
                  <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider whitespace-nowrap">
                    Current Catalog ({catalog.length})
                  </h3>
                  
                  {/* NEW SEARCH BAR */}
                  <div className="relative w-full max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search dishes..." 
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
                {filteredCatalog.length === 0 ? (
                  <p className="text-center text-gray-500 py-8 bg-white rounded-xl border border-gray-100">Your catalog is empty.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredCatalog.map(dish => (
                      <div key={dish.id} className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center hover:shadow-sm transition group">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">{dish.dish_name}</span>
                          <span className={`text-[10px] uppercase font-bold w-fit px-2 py-0.5 rounded mt-1 ${
                            dish.diet_type === 'Veg' ? 'bg-green-100 text-green-700' : 
                            dish.diet_type === 'Common' ? 'bg-blue-100 text-blue-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {dish.diet_type}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleDeleteFromCatalog(dish.id, dish.dish_name)}
                          className="text-red-500 hover:bg-red-50 hover:text-red-700 p-2 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition focus:opacity-100"
                          title="Delete from catalog"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* MODAL 2: THE AI MENU GENERATOR MODAL     */}
      {/* ========================================= */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-purple-100">
            
            {/* AI Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-6 text-white text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
              <BrainCircuit size={48} className="mx-auto mb-3 text-purple-200" />
              <h2 className="text-2xl font-black tracking-tight">AI Menu Architect</h2>
              <p className="text-purple-200 text-sm mt-1 font-medium">Generate a data-driven weekly schedule.</p>
            </div>

            <div className="p-6 space-y-6 bg-gray-50">
              
              {/* Instructions */}
              <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-sm text-purple-800 leading-relaxed">
                The AI will analyze your <strong>Menu Catalog</strong> (costs, effort scores) and historical <strong>Student Reviews</strong> to build the optimal 7-day schedule.
              </div>

              {/* Custom Prompt / Focus */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Any specific instructions for the AI? (Optional)
                </label>
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., 'Keep the total budget strictly under ₹500 per day' or 'Avoid repeating Dal this week.'"
                  className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none h-24"
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowAIModal(false)}
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

      {/* ========================================= */}
      {/* MODAL 3: ASSIGN DISH TO MENU SCHEDULE     */}
      {/* ========================================= */}
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
      {/* ========================================= */}
      {/* MODAL 4: EDIT MEAL TIMINGS                */}
      {/* ========================================= */}
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
    </div>
  );
};

const MessReviewsTab = () => {
  const [allReviews, setAllReviews] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

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
      // Fetch both Reviews and the Menu Catalog for the Bayesian Scores!
      const [revRes, catRes] = await Promise.all([
        axios.get('http://localhost:3001/api/admin/mess-reviews'),
        axios.get('http://localhost:3001/api/admin/menu-catalog')
      ]);
      setAllReviews(revRes.data);
      setCatalog(catRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
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
    // NEW: Filter the catalog based on the selected Meal Type dropdown!
    let applicableCatalog = catalog;
    
    if (filterMeal !== 'All') {
      applicableCatalog = catalog.filter(dish => 
        // If it has never been served, it won't have served_meals, so we safely ignore it
        dish.served_meals && dish.served_meals.includes(filterMeal)
      );
    }

    // Sort the newly filtered list
    const sortedCatalog = [...applicableCatalog].sort((a, b) => Number(b.popularity_score) - Number(a.popularity_score));
    
    const topB = sortedCatalog.slice(0, 3);
    const bottomB = sortedCatalog.slice(-3).reverse(); // Reverse so absolute worst is first

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

  const handleGenerateInsights = async () => {
    if (filteredReviews.length === 0) return alert("No reviews to analyze!");
    setGeneratingAI(true);
    try {
      const res = await axios.post('http://localhost:3001/api/admin/generate-insights', {
        reviews: filteredReviews,
        stats: stats
      });
      setAiSummary(res.data.summary);
    } catch (err) {
      alert("Failed to generate AI insights.");
    } finally {
      setGeneratingAI(false);
    }
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
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Star size={18} className="text-yellow-500"/> Bayesian Rankings
            </h3>
            
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

          {/* COL 2: Top Complained (Filtered Context) */}
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
              <Filter size={18} className="text-blue-500"/> Triage Controls
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

        {/* ROW 4: REVIEW FEED (Same as before, visually tightened) */}
        <div>
          <h3 className="font-bold text-gray-800 mb-4 text-xl">Review Logs ({filteredReviews.length})</h3>
          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-500 border border-gray-100 font-medium">No reviews match your current filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredReviews.map((review) => (
                <div key={review.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-100 hover:shadow-md transition relative ${review.rating <= 2 ? 'ring-2 ring-red-400/50' : review.rating === 3 ? 'border-t-4 border-t-yellow-400' : 'border-t-4 border-t-green-400'}`}>
                  
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-800">{review.meal_type}</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{formatDate(review.serve_date)} • UID: {review.uid}</p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${review.diet_type === 'Veg' ? 'bg-green-100 text-green-700' : review.diet_type === 'Common' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{review.diet_type}</span>
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
  const [activeTab, setActiveTab] = useState('home');
  
  // Sidebar 
  const menuItems = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'mess', label: 'Mess Reviews', icon: <ClipboardList size={20} /> },
    { id: 'menu', label: 'Menu Management', icon: <Utensils size={20} /> },
    { id: 'overnight', label: 'Overnight Stay', icon: <Moon size={20} /> },
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

        <div className="p-4 border-t border-gray-100 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-gray-600 text-sm font-medium">
            <Settings size={20} /> Settings
          </button>
          <button 
             onClick={() => window.location.href = "/"}
             className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition"
          >
            <LogOut size={20} /> Sign Out
          </button>
        </div>
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