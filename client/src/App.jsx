import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AppLayout from './AppLayout';
import GatePass from './GatePass';
import StudentComplaint from './StudentComplaint';
import WardenDashboard from './WardenDashboard';
import MessReview from './MessReview';

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  return (
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
  );
}

export default App;