import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
const API_BASE = 'http://192.168.1.11:3001/api'; 

function Login({ setUser }) {
  const [uid, setuid] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

 const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(''); 

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        uid,
        password
      });

      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        navigate('/app/gatepass');
      }
    } catch (err) {
      console.error("Login Error:", err);
      
      // Error Handling 
      if (err.code === "ERR_NETWORK") {
        setError("Server is OFFLINE. Please start the Backend.");
      } else if (err.response && err.response.status === 401) {
        setError("Invalid Credentials. Try again.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 font-sans">
      {/* Header Text */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Student Portal</h1>
        <p className="text-gray-500">Hostel Administration System</p>
      </div>

      {/* Login Card */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 animate-pulse">
        <span>{error}</span>
        </div>
      )}

      {/* User Inputs*/}
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm">
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">College UID</label>
          <input 
            className="w-full p-3 rounded-lg bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="Enter your UID" 
            value={uid}
            onChange={(e) => setuid(e.target.value)} 
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
          <input 
            className="w-full p-3 rounded-lg bg-gray-100 border-none text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" 
            type="password" 
            placeholder="Enter your password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
          />
        </div>

        <button 
        disabled={loading} 
        className={`w-full p-3 rounded-xl font-bold transition shadow-md shadow-blue-200 text-white
        ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} 
        onClick={handleLogin}
        >
            {loading ? 'Logging in...' : 'Login'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Use your college credentials to login
        </p>
      </div>
    </div>
  );
}

export default Login;