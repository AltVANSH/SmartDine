import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, LogOut, QrCode, User, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Guest';

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-100 p-1.5 rounded-lg">
            <ChefHat className="text-emerald-600" size={24} />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">SmartDine</span>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
        >
          <LogOut size={18} />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto p-6 mt-6">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-800">Welcome, {userName}!</h1>
          <p className="text-slate-500 mt-2">You are not currently seated at a table.</p>
        </header>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Join Queue Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <QrCode className="text-emerald-600" size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Join a Restaurant</h3>
            <p className="text-slate-500 mb-6">Enter a branch code (e.g. TAJ-001) or scan a QR code to join the waitlist.</p>
            <div className="flex items-center text-emerald-600 font-semibold gap-2">
              Enter Code <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Join Friends Card */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <User className="text-blue-600" size={28} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Join a Table</h3>
            <p className="text-slate-500 mb-6">Have an invite code from a friend? Enter it here to join their shared cart.</p>
            <div className="flex items-center text-blue-600 font-semibold gap-2">
              Enter Invite Link <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}