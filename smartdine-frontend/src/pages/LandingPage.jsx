import React, { useState, useEffect } from 'react';
import { useNavigate as useNav } from 'react-router-dom';
import { QrCode, Keyboard, Loader2, ChefHat, ArrowRight, Camera } from 'lucide-react';
import axios from 'axios';

export default function LandingPage() {
  const [restaurantCode, setRestaurantCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNav();

  useEffect(() => {
    // If restaurant code is already validated and token exists, jump straight to dashboard
    const code = localStorage.getItem('restaurantCode');
    const token = localStorage.getItem('token');
    if (code && token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!restaurantCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { data } = await axios.post('http://localhost:5000/api/queue/validate-code', {
        restaurantCode: restaurantCode.trim()
      });

      if (data.status === 'success') {
        localStorage.setItem('restaurantCode', restaurantCode.trim().toUpperCase());
        
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

  const handleMockScan = () => {
    setShowScanner(true);
    setLoading(true);
    // Simulate camera scanning after 2 seconds
    setTimeout(async () => {
      try {
        const { data } = await axios.post('http://localhost:5000/api/queue/validate-code', {
          restaurantCode: 'TAJ-001'
        });
        if (data.status === 'success') {
          localStorage.setItem('restaurantCode', 'TAJ-001');
          const token = localStorage.getItem('token');
          if (token) {
            navigate('/dashboard');
          } else {
            navigate('/auth');
          }
        }
      } catch (err) {
        setError('Scanning failed. Try manual entry.');
      } finally {
        setLoading(false);
        setShowScanner(false);
      }
    }, 2000);
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
            Scan the table QR code or enter the restaurant code displayed at reception.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-r-lg text-sm text-center">
            {error}
          </div>
        )}

        {showScanner ? (
          /* Mock Camera Scanner UI */
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-400 rounded-2xl p-8 bg-emerald-50/50 animate-pulse relative h-64">
            <Camera className="text-emerald-600 animate-spin mb-4" size={48} />
            <p className="text-emerald-800 font-semibold text-sm">Initializing Camera Scanner...</p>
            <p className="text-slate-400 text-xs mt-2">Aiming at physical QR code...</p>
            <div className="absolute bottom-4 flex gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
              <span className="text-[10px] text-emerald-700 font-medium">Scanning Live</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Camera Scan Trigger Button */}
            <button
              onClick={handleMockScan}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-md shadow-emerald-600/10 hover:shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              <QrCode size={22} />
              <span>Scan Table QR Code</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs font-semibold uppercase">Or Type Code</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

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
        )}

        {/* Info footer */}
        <div className="mt-8 text-center text-xs text-slate-400 font-medium">
          Entering code validation establishes your active dining instance.
        </div>

      </div>
    </div>
  );
}
