import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AppLayout from './AppLayout';
import GatePass from './GatePass';
import StudentComplaint from './StudentComplaint';
import WardenDashboard from './WardenDashboard';
import MessReview from './MessReview';
import { Toaster } from 'react-hot-toast'; 

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'text-sm font-bold shadow-lg rounded-xl border border-gray-100',
          duration: 4000,
          success: {
            style: { background: '#f0fdf4', color: '#166534' },
            iconTheme: { primary: '#16a34a', secondary: '#fff' }
          },
          error: {
            style: { background: '#fef2f2', color: '#991b1b' },
            iconTheme: { primary: '#dc2626', secondary: '#fff' }
          },
        }}
      />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login setUser={setUser} />} />
        <Route path="/warden" element={<WardenDashboard />} />
        {/* Protected Routes Wrapper */}
        <Route path="/app" element={user ? <AppLayout user={user} /> : <Navigate to="/" />}>
          <Route path="gatepass" element={<GatePass />} />
          <Route path="mess" element={<MessReview />} />
          <Route path="complaint" element={<StudentComplaint />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </>
  );
}

export default App;