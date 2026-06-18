import React, { useState, useEffect } from 'react';
import { useNavigate as useNav } from 'react-router-dom';
import { Keyboard, Loader2, ChefHat, ArrowRight } from 'lucide-react';
import axios from 'axios';

export default function LandingPage() {
  const [restaurantCode, setRestaurantCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNav();

  useEffect(() => {
    // If restaurant code is already validated and token exists, jump straight to dashboard
    const cachedCode = localStorage.getItem('restaurantCode');
    const token = localStorage.getItem('token');
    if (cachedCode && token) {
      navigate('/dashboard');
      return;
    }

    // Check if user arrived via QR Code scan containing ?code=TAJ-001
    const searchParams = new URLSearchParams(window.location.search);
    const codeFromUrl = searchParams.get('code');
    
    if (codeFromUrl) {
      setRestaurantCode(codeFromUrl);
      validateCode(codeFromUrl);
    }
  }, [navigate]);

  const validateCode = async (code) => {
    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/queue/validate-code`, {
        restaurantCode: code.trim()
      });

      if (data.status === 'success') {
        localStorage.setItem('restaurantCode', code.trim().toUpperCase());
        
        // If user is already logged in, redirect to dashboard, otherwise to auth
        const token = localStorage.getItem('token');
        if (token) {
          navigate('/dashboard');
        } else {
          navigate('/auth');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid restaurant code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!restaurantCode.trim()) return;
    validateCode(restaurantCode);
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-200 rounded-full blur-3xl opacity-60"></div>

      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 relative z-10 border border-emerald-100/50">
        
        {/* Branding header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-emerald-600 p-3.5 rounded-2xl text-white shadow-lg shadow-emerald-600/20 mb-4 animate-bounce">
            <ChefHat size={36} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">SmartDine</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xs">
            Enter the restaurant code displayed below the QR code at reception.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Manual Form Entry */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Restaurant Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Keyboard className="h-5 w-5 text-emerald-500" />
                </div>
                <input
                  type="text"
                  required
                  value={restaurantCode}
                  onChange={(e) => {
                    setRestaurantCode(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. TAJ-001"
                  className="block w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 font-bold uppercase tracking-wider text-slate-700 placeholder-slate-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !restaurantCode.trim()}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Code'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        {/* Info footer */}
        <div className="mt-8 text-center text-xs text-slate-400 font-medium">
          Entering code validation establishes your active dining instance.
        </div>

      </div>
    </div>
  );
}
