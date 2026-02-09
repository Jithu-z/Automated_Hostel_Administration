import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ClipboardList, DoorOpen, MessageSquare, LogOut } from 'lucide-react';

function AppLayout({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Mess Review', path: '/app/mess', icon: <ClipboardList size={20} /> },
    { name: 'Digital Gatepass', path: '/app/gatepass', icon: <DoorOpen size={20} /> },
    { name: 'Complaint', path: '/app/complaint', icon: <MessageSquare size={20} /> },
  ];
  const handleLogout = () => {
  localStorage.removeItem('user'); 
  window.location.href = "/"; 
  };
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Header (Blue) */}
      <div className="bg-blue-600 text-white p-6 pb-8 rounded-b-3xl shadow-md z-10">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center text-sm font-bold">
              {user?.full_name ? user.full_name.substring(0,2).toUpperCase() : '?'}
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">{user?.full_name || "User"}</h2>
              <p className="text-xs text-blue-200">{user?.uid || "u???"}</p>
            </div>
          </div>
          <button className="text-xs flex items-center gap-1 bg-blue-700 px-3 py-1 rounded-full opacity-90 hover:opacity-100" onClick={handleLogout}>
            <LogOut size={12} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area*/}
      <div className="flex-1 overflow-y-auto pb-24 p-6 -mt-4">
        <Outlet /> 
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 w-full bg-white border-t border-gray-100 flex justify-around py-3 px-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button 
              key={item.name}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 w-full ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.name}</span>
            </button>
          )
        })}
      </div>

    </div>
  );
}

export default AppLayout;