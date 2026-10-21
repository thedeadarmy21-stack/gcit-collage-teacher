import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/api/auth/login`, {
        username,
        password,
      });

      localStorage.setItem('teacherToken', response.data.token);
      localStorage.setItem('teacherData', JSON.stringify(response.data.teacher));
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Server check karo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-700">
        <div className="text-center mb-8">
          <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-600 p-1 shadow-lg shadow-green-900/50">
            <img src="/logo.png" alt="GCIT Logo" className="h-full w-full object-contain rounded-full" />
          </div>
          <h2 className="text-2xl font-bold text-white">GCIT Collage</h2>
          <p className="text-slate-400 text-sm mt-1">Attendance System</p>
        </div>
        
        {error && <div className="bg-red-900/50 text-red-400 p-3 rounded-xl mb-6 text-sm font-semibold text-center border border-red-800">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-slate-400 text-sm font-bold mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 transition duration-200 shadow-lg shadow-green-900/50 mt-4"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;