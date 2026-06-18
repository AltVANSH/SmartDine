import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Mail, Lock, User, ArrowRight, Loader2, UtensilsCrossed, BadgeCheck } from 'lucide-react';
import axios from 'axios';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'waiter'
  });

  // If user is already logged in, redirect them to dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('staffRole');
    if (token) {
      if (role === 'kitchen') navigate('/kds');
      else if (role === 'waiter') navigate('/waiter');
      else if (role === 'manager') navigate('/manager');
      else navigate('/dashboard');
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let endpoint = '';
      if (isStaff) {
        endpoint = isLogin ? '/api/auth/staff/login' : '/api/auth/staff/register';
      } else {
        endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      }
      
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${endpoint}`, formData);
      
      // Save token and user details to local storage
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.name);
      localStorage.setItem('userId', data._id);
      
      if (isStaff) {
        localStorage.setItem('staffRole', data.role);
        if (data.role === 'kitchen') navigate('/kds');
        else if (data.role === 'manager') navigate('/manager');
        else navigate('/waiter');
      } else {
        navigate('/dashboard');
      }
      
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Is your backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side - Branding */}
        <div className="md:w-5/12 bg-emerald-600 p-10 text-white flex flex-col justify-between relative overflow-hidden hidden md:flex">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 text-emerald-500 opacity-50 transform rotate-12">
            <UtensilsCrossed size={200} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="bg-white p-2 rounded-xl">
                <ChefHat className="text-emerald-600" size={32} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">SmartDine</h1>
            </div>
            <div className="mt-20">
              <h2 className="text-4xl font-bold leading-tight mb-6">The future of<br/>dine-in is here.</h2>
              <p className="text-emerald-100 text-lg leading-relaxed">
                Skip the lines. Order together. Split the bill instantly.
              </p>
            </div>
          </div>
          <div className="relative z-10 text-emerald-200 text-sm">© 2026 SmartDine Systems</div>
        </div>

        {/* Right Side - Form */}
        <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center relative">
          <div className="max-w-md w-full mx-auto">
            
            {/* Toggle Switch */}
            <div className="flex justify-center mb-8">
              <div className="bg-slate-100 p-1 rounded-xl inline-flex">
                <button
                  type="button"
                  onClick={() => { setIsStaff(false); setError(''); }}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${
                    !isStaff ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Diner Portal
                </button>
                <button
                  type="button"
                  onClick={() => { setIsStaff(true); setError(''); }}
                  className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                    isStaff ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <BadgeCheck size={16} /> Staff Portal
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6 md:hidden justify-center">
              <div className="bg-emerald-100 p-2 rounded-xl">
                <ChefHat className="text-emerald-600" size={28} />
              </div>
              <h1 className="text-2xl font-bold text-emerald-900 tracking-tight">SmartDine</h1>
            </div>

            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              {isLogin ? 'Welcome back' : 'Create an account'}
            </h2>
            <p className="text-slate-500 mb-8">
              {isStaff
                ? (isLogin ? 'Enter your staff details to access your dashboard.' : 'Sign up to manage operations.')
                : (isLogin ? 'Enter your details to access your table.' : 'Sign up to start ordering with friends.')}
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-emerald-500" />
                    </div>
                    <input
                      type="text"
                      name="name"
                      required={!isLogin}
                      value={formData.name}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition-colors"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              {isStaff && !isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="block w-full pl-3 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition-colors"
                  >
                    <option value="waiter">Waiter</option>
                    <option value="kitchen">Kitchen Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              )}

              {isStaff ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-emerald-500" />
                    </div>
                    <input
                      type="text"
                      name="username"
                      required
                      value={formData.username}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition-colors"
                      placeholder="staff_user"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-emerald-500" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-emerald-500" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Create Account')}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-600">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <button
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="font-semibold text-emerald-600 hover:text-emerald-500 focus:outline-none transition-colors"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}