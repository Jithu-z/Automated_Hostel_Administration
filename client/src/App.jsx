import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AppLayout from './AppLayout';
import GatePass from './GatePass';

const MessReview = () => <div className="p-4 text-center text-gray-500 mt-10">Mess Review UI Coming Soon</div>;
const Complaint = () => <div className="p-4 text-center text-gray-500 mt-10">Complaint UI Coming Soon</div>;

function App() {
  const [user, setUser] = useState(null);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login setUser={setUser} />} />
        
        {/* Protected Routes Wrapper */}
        <Route path="/app" element={user ? <AppLayout user={user} /> : <Navigate to="/" />}>
          <Route path="gatepass" element={<GatePass />} />
          <Route path="mess" element={<MessReview />} />
          <Route path="complaint" element={<Complaint />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;