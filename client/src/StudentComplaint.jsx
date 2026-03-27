import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  AlertCircle, CheckCircle, Send, Home, PenTool, Clock, Plus, ArrowLeft, X, History, Upload, FileVideo, Lock, Map
} from 'lucide-react';
import toast from 'react-hot-toast';

const SERVER_URL = 'http://192.168.1.11:3001';
const API_BASE = `${SERVER_URL}/api`;

function StudentComplaint() {
  const [view, setView] = useState('loading'); // 'loading', 'list', 'form'
  const [complaints, setComplaints] = useState([]);
  const [hostelStatus, setHostelStatus] = useState('in');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileType, setFileType] = useState(null); // 'image' or 'video'
  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState(null);

  const user = JSON.parse(localStorage.getItem('user'));
  const uid = user ? user.uid : 'Unknown';

  const [formData, setFormData] = useState({
    category: 'Electrical',
    room_no: user?.room_no || '',
    description: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setView('loading');
    checkStatus();
    fetchHistory();
  }, [uid]);

  const checkStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/gate/status/${uid}`);
      setHostelStatus(res.data.status); 
    } catch (err) {
      console.error("Failed to fetch campus status", err);
    }
  };

  const fetchHistory = () => {
    axios.get(`${API_BASE}/student/grievances/${uid}`)
      .then(res => {
        setComplaints(res.data);
        if (res.data.length === 0) setView('form');
        else setView('list');
      })
      .catch(err => {
        console.error(err);
        toast.error("Failed to load complaints.");
        setView('form');
      });
  };

  const handleAcknowledge = (id) => {
    toast.promise(
      axios.put(`${API_BASE}/student/grievances/acknowledge/${id}`),
      {
        loading: 'Dismissing notification...',
        success: () => {
          setComplaints(complaints.map(c => c.id === id ? { ...c, is_acknowledged: 1 } : c));
          return 'Resolved issue dismissed.';
        },
        error: "Failed to dismiss notification."
      }
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File is too large (Max 10MB). Please compress it."); 
        toast.error("File exceeds 10MB limit.");
        return; 
      }

      setUploadError(null); 
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setFileType(file.type.startsWith('video/') ? 'video' : 'image');
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.room_no.trim() || !formData.description.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSubmitting(true);

    const data = new FormData();
    data.append('uid', uid);
    data.append('category', formData.category);
    data.append('room_no', formData.room_no.trim());
    data.append('description', formData.description.trim());
    if (selectedFile) {
      data.append('evidence', selectedFile); 
    }

    toast.promise(
      axios.post(`${API_BASE}/student/grievances`, data),
      {
        loading: 'Submitting complaint...',
        success: () => {
          setFormData({ category: 'Electrical', room_no: user?.room_no || '', description: '' });
          clearFile();
          setTimeout(() => fetchHistory(), 1000); 
          return "Complaint submitted successfully!";
        },
        error: "Failed to submit complaint. Try again."
      }
    ).finally(() => setSubmitting(false));
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // --- FILTERING LOGIC ---
  const unreadResolved = complaints.filter(c => c.status === 'Resolved' && !c.is_acknowledged);
  const activeIssues = complaints.filter(c => c.status !== 'Resolved');
  const historyLog = complaints
    .filter(c => c.status === 'Resolved' && c.is_acknowledged)
    .slice(0, 5); 

  const getStatusColor = (status) => {
    switch(status) {
      case 'Resolved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  if (view === 'loading') return <div className="p-10 text-center text-gray-400 font-bold animate-pulse">Loading Complaints...</div>;

  if (hostelStatus === 'out') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in px-4">
          <div className="bg-orange-50 text-orange-500 p-6 rounded-full mb-6 relative">
            <Map size={48} />
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1.5 shadow-sm border border-gray-100">
              <Lock size={20} className="text-gray-700" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">You are currently away!</h2>
          <p className="text-gray-500 max-w-md mx-auto leading-relaxed mb-8">
            Mess reviews and complaints are paused while you are checked out of the hostel. Enjoy your time away, and we'll see you when you get back!
          </p>
          <div className="bg-white border border-gray-200 px-6 py-3 rounded-xl shadow-sm text-sm font-bold text-gray-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            Status: Checked Out
          </div>
        </div>
      );
    }

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
                    className="bg-green-50 border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-pulse cursor-pointer p-5 rounded-2xl relative overflow-hidden"
                >
                    <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-green-700 font-bold">
                        <CheckCircle size={18} /> 
                        <span>{c.category === 'Other' ? 'Issue Resolved' : `${c.category} Issue Resolved`}</span>
                    </div>
                    <span className="text-[10px] font-bold text-green-800 px-2 py-1 rounded-full">
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
                  
                  {/* ✨ Ensure uploaded images construct full URL */}
                  {c.img_url && (
                    <div className="mt-3">
                       <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Attachment</p>
                       <div className="h-16 w-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                          {c.img_url.endsWith('.mp4') || c.img_url.endsWith('.webm') ? (
                             <FileVideo className="text-gray-400" />
                          ) : (
                             <img src={`${SERVER_URL}${c.img_url}`} alt="proof" className="w-full h-full object-cover" />
                          )}
                       </div>
                    </div>
                  )}
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
             <div className="text-center py-10 text-gray-400 font-medium">No complaints found.</div>
          )}
        </div>
      </div>
    );
  }

  // --- FORM VIEW ---
  return (
    <div className="animate-fade-in p-4 pb-24 max-w-lg mx-auto">
      <div className="mb-6 flex items-center gap-3">
        {complaints.length > 0 && (
          <button onClick={() => setView('list')} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">GRIEVANCE FORM</h1>
          <p className="text-gray-500 text-sm">Facing trouble? Let the warden know.</p>
        </div>
      </div>
      
      {/* form structure */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-5">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Category</label>
          <div className="grid grid-cols-2 gap-3">
            {['Electrical', 'Plumbing', 'Furniture', 'Other'].map((cat) => (
              <button 
                key={cat} 
                type="button" 
                onClick={() => setFormData({ ...formData, category: cat })} 
                className={`py-3 px-2 rounded-xl text-sm font-medium transition-all border ${formData.category === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Location of Issue</label>
          <input 
            name="room_no" 
            value={formData.room_no} 
            onChange={(e) => setFormData({ ...formData, room_no: e.target.value })} 
            placeholder="e.g., Room E-27, 2nd Floor Bathroom, Study Hall..." 
            className="bg-gray-50 w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white border border-transparent focus:border-blue-200 transition-all text-sm text-gray-800 font-medium" 
          />
        </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Description</label>
          <textarea 
            name="description" 
            value={formData.description} 
            onChange={handleChange} 
            placeholder="Enter description......." 
            className="bg-gray-50 w-full rounded-xl px-4 py-3 outline-none min-h-[100px] resize-none focus:ring-2 focus:ring-blue-100 focus:bg-white border border-transparent focus:border-blue-200 transition-all" 
          />
        </div>
        <div>
           <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Evidence (Optional)</label>
           
           <input 
             type="file" 
             ref={fileInputRef}
             accept="image/*,video/*"
             onChange={handleFileSelect} 
             className="hidden" 
           />

           {!previewUrl ? (
             <button 
               type="button" 
               onClick={() => fileInputRef.current.click()}
               className={`w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center transition-colors gap-2 ${
                        uploadError ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
             >
               <div className="bg-blue-50 p-3 rounded-full text-blue-500">
                 {uploadError ? <AlertCircle size={24} className="text-red-500"/> : <Upload size={24} />}
               </div>
               <span className={`text-sm font-medium ${uploadError ? 'text-red-500' : 'text-gray-500'}`}>
                 {uploadError ? 'Upload Failed' : 'Upload Photo or Video'}
               </span>
               <span className="text-[10px] text-gray-400">Max size 10MB</span>
             </button>
           ) : (
             <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black">
               {fileType === 'video' ? (
                 <video src={previewUrl} controls className="w-full h-48 object-contain" />
               ) : (
                 <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
               )}
               
               <button 
                 type="button" 
                 onClick={clearFile}
                 className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/80 backdrop-blur-sm z-10 transition-colors"
               >
                 <X size={16} />
               </button>
             </div>
           )}
           {uploadError && (
              <p className="text-xs text-red-500 font-bold mt-2 flex items-center gap-1 animate-pulse">
                <AlertCircle size={12} /> {uploadError}
              </p>
           )}
        </div>
        
        <button 
            type="submit" 
            disabled={submitting} 
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${submitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'}`}
        >
            {submitting ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  );
}

export default StudentComplaint;