import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  AlertCircle, CheckCircle, Send, Home, PenTool, Clock, Plus, ArrowLeft, X, History 
} from 'lucide-react';

function StudentComplaint() {
  const [view, setView] = useState('loading'); // 'loading', 'list', 'form'
  const [complaints, setComplaints] = useState([]);
  
  const [formData, setFormData] = useState({
    category: 'Electrical',
    room_no: '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const user = JSON.parse(localStorage.getItem('user'));
  const uid = user ? user.uid : 'Unknown';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = () => {
    axios.get(`http://10.218.123.123:3001/api/student/grievances/${uid}`)
      .then(res => {
        setComplaints(res.data);
        if (res.data.length === 0) setView('form');
        else setView('list');
      })
      .catch(err => {
        console.error(err);
        setView('form');
      });
  };

  const handleAcknowledge = async (id) => {
    const updated = complaints.map(c => 
      c.id === id ? { ...c, is_acknowledged: 1 } : c
    );
    setComplaints(updated);

    try {
      await axios.put(`http://10.218.123.123:3001/api/student/grievances/acknowledge/${id}`);
    } catch (err) {
      console.error("Failed to acknowledge");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    if (!formData.room_no || !formData.description) {
      alert("Please fill in all fields.");
      setSubmitting(false);
      return;
    }

    try {
      await axios.post('http://10.218.123.123:3001/api/student/grievances', {
        uid: uid,
        room_no: formData.room_no,
        category: formData.category,
        description: formData.description
      });
      setStatus('success');
      setFormData({ category: 'Electrical', room_no: '', description: '' });
      setTimeout(() => {
        setStatus(null);
        fetchHistory(); 
      }, 1500);
    } catch (err) {
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // --- FILTERING LOGIC ---
  const unreadResolved = complaints.filter(c => c.status === 'Resolved' && !c.is_acknowledged);
  const activeIssues = complaints.filter(c => c.status !== 'Resolved');
  const historyLog = complaints
    .filter(c => c.status === 'Resolved' && c.is_acknowledged)
    .slice(0, 5); // Limit to 5

 
  const getStatusColor = (status) => {
    switch(status) {
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  if (view === 'loading') return <div className="p-10 text-center text-gray-400">Loading...</div>;

  // --- LIST VIEW ---
  if (view === 'list') {
    return (
      <div className="animate-fade-in p-4 pb-24 max-w-lg mx-auto">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Complaints</h1>
            <p className="text-gray-500 text-sm">Track status of your reported issues</p>
          </div>
          <button 
            onClick={() => setView('form')}
            className="bg-blue-600 text-white p-3 rounded-xl shadow-lg hover:bg-blue-700 transition active:scale-95"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="space-y-6">
          
          {/* 1. UNREAD RESOLUTIONS (High Priority) */}
          {unreadResolved.length > 0 && (
            <div className="space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Action Required</p>
                
                {unreadResolved.map((c) => (
                <div 
                    key={c.id} 
                    onClick={() => handleAcknowledge(c.id)}
                    // THE FIX: Standard Tailwind Pulse + Green Shadow
                    className="bg-green-50 border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse cursor-pointer p-5 rounded-2xl relative overflow-hidden"
                >
                    <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-green-700 font-bold">
                        <CheckCircle size={18} /> 
                        <span>{c.category === 'Other' ? 'Issue Resolved' : `${c.category} Issue Resolved`}</span>
                    </div>
                    <span className="text-[10px] font-bold  text-green-800 px-2 py-1 rounded-full">
                        Tap to Dismiss
                    </span>
                    </div>
                    
                    <p className="text-gray-700 text-sm mb-3 font-medium">"{c.description}"</p>
                    
                    <div className="text-xs text-green-800 opacity-80 font-bold">
                    Resolved on: {new Date(c.date_resolved).toLocaleDateString()}
                    </div>
                </div>
                ))}
            </div>
          )}

          {/* 2. ACTIVE ISSUES */}
          {activeIssues.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Issues</p>
              {activeIssues.map((c) => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase rounded-bl-xl border-b border-l ${getStatusColor(c.status)}`}>
                    {c.status}
                  </div>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-gray-50 rounded-lg text-gray-500"><PenTool size={18} /></div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">{c.category} Issue</h3>
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> {new Date(c.date_logged).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed pl-1">"{c.description}"</p>
                </div>
              ))}
            </div>
          )}

          {/* 3. HISTORY LOG (Limit 5) */}
          {historyLog.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-4 text-gray-400">
                <History size={14} />
                <p className="text-xs font-bold uppercase tracking-wider">Recent History</p>
              </div>
              <div className="space-y-2">
                {historyLog.map((c) => (
                  <div key={c.id} className="flex justify-between items-center text-xs p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-500">
                    <span className="font-medium truncate max-w-[60%]">{c.category}: {c.description}</span>
                    <span className="text-gray-400">{new Date(c.date_resolved).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {unreadResolved.length === 0 && activeIssues.length === 0 && historyLog.length === 0 && (
             <div className="text-center py-10 text-gray-400">No complaints found.</div>
          )}
        </div>
      </div>
    );
  }

  // --- FORM VIEW (Same as before) ---
  return (
    <div className="animate-fade-in p-4 pb-24 max-w-lg mx-auto">
      <div className="mb-6 flex items-center gap-3">
        {complaints.length > 0 && (
          <button onClick={() => setView('list')} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vishayam aano mone?</h1>
          <p className="text-gray-500 text-sm">Facing trouble? Let the warden know.</p>
        </div>
      </div>
      {status === 'success' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-green-700 animate-slide-up">
          <CheckCircle size={20} />
          <div><p className="font-bold text-sm">Complaint Submitted!</p></div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Category</label>
          <div className="grid grid-cols-2 gap-3">
            {['Electrical', 'Plumbing', 'Furniture', 'Other'].map((cat) => (
              <button key={cat} type="button" onClick={() => setFormData({ ...formData, category: cat })} className={`py-3 px-2 rounded-xl text-sm font-medium transition-all border ${formData.category === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Room No</label>
          <input name="room_no" value={formData.room_no} onChange={handleChange} placeholder="e.g. E-27" className="bg-gray-50 w-full rounded-xl px-4 py-3 outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} placeholder="endhaan vishayam?..kelkatte" className="bg-gray-50 w-full rounded-xl px-4 py-3 outline-none min-h-[100px]" />
        </div>
        <button type="button" onClick={handleSubmit} disabled={submitting} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg ${submitting ? 'bg-blue-400' : 'bg-blue-600'}`}>{submitting ? 'Submitting...' : 'Submit Complaint'}</button>
      </form>
    </div>
  );
}

export default StudentComplaint;