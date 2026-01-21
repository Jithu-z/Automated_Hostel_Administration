import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login({ setUser }) {
  const [rollNo, setRollNo] = useState('');
  const [pass, setPass] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      // Connect to Member 1's backend
      const res = await axios.post('http://localhost:3001/api/login', { 
        roll_no: rollNo, 
        password: pass 
      });
      if (res.data.success) {
        setUser(res.data.user);
        navigate('/app/gatepass'); // Default to Gatepass for Day 1 Demo
      }
    } catch (err) {
      alert("Invalid Login! (Try: CS101 / 1234)");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 font-sans">
      {/* Header Text */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Portal</h1>
        <p className="text-gray-500">Hostel Management System</p>
      </div>

      {/* Login Card */}
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
        
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">College UID</label>
          <input 
            className="w-full p-3 rounded-lg bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Enter your UID" 
            value={rollNo}
            onChange={(e) => setRollNo(e.target.value)} 
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
          <input 
            className="w-full p-3 rounded-lg bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" 
            type="password" 
            placeholder="Enter your password" 
            value={pass}
            onChange={(e) => setPass(e.target.value)} 
          />
        </div>

        <button 
          className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md shadow-blue-200"
          onClick={handleLogin}
        >
          Login
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Use your college credentials to login
        </p>
      </div>
    </div>
  );
}

export default Login;