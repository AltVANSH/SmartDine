import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { LogOut, Loader2, DollarSign, Calendar, TrendingUp, Download, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function ManagerPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ todaySales: 0, monthlySales: 0, popularItems: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchStats();

    const token = localStorage.getItem('token');
    const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}`, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Manager socket connected');
      socket.emit('join_manager');
    });

    socket.on('sales_updated', () => {
      fetchStats();
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/manager/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load statistics.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('staffRole');
    navigate('/auth');
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/manager/export/yesterday`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!data || data.length === 0) {
        alert('No completed sessions found to export.');
        setDownloading(false);
        return;
      }

      // Convert JSON to CSV
      const headers = Object.keys(data[0]);
      const csvRows = [];
      csvRows.push(headers.join(',')); // Add Header row

      for (const row of data) {
        const values = headers.map(header => {
          const val = row[header];
          const escaped = ('' + val).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }

      const csvString = csvRows.join('\n');
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `smartdine_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (err) {
      console.error(err);
      alert('Failed to download report.');
    } finally {
      setDownloading(false);
    }
  };

  // Modern color palette for the bar chart
  const colors = ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 p-2 rounded-xl">
              <PieChart size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">Manager Dashboard</h1>
              <p className="text-xs text-emerald-400 font-medium mt-1">SmartDine Overview</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors text-sm font-semibold"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-medium">
            {error}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-sm mb-2">Today's Sales</p>
              <h2 className="text-5xl font-black text-slate-800">${stats.todaySales.toFixed(2)}</h2>
            </div>
            <div className="bg-emerald-100 p-4 rounded-2xl relative z-10 group-hover:scale-110 transition-transform">
              <DollarSign className="text-emerald-600" size={40} />
            </div>
            {/* Decorative background shape */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-50 rounded-full opacity-50 blur-2xl"></div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex items-center justify-between relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-slate-500 font-semibold uppercase tracking-wider text-sm mb-2">Monthly Sales</p>
              <h2 className="text-5xl font-black text-slate-800">${stats.monthlySales.toFixed(2)}</h2>
            </div>
            <div className="bg-blue-100 p-4 rounded-2xl relative z-10 group-hover:scale-110 transition-transform">
              <Calendar className="text-blue-600" size={40} />
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-50 rounded-full opacity-50 blur-2xl"></div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Section */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-500" size={24} />
              <h3 className="text-xl font-bold text-slate-800">Top Selling Items</h3>
            </div>
            
            {stats.popularItems && stats.popularItems.length > 0 ? (
              <div className="flex-1 w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.popularItems} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                    <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fill: '#64748b', fontSize: 12 }} interval={0} height={80} />
                    <YAxis tick={{ fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="sold" radius={[8, 8, 0, 0]}>
                      {stats.popularItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <PieChart size={64} className="mb-4 opacity-20" />
                <p>No item data available yet.</p>
              </div>
            )}
          </div>

          {/* Export Section */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-xl text-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full opacity-10 blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="relative z-10">
              <div className="bg-white/10 p-3 rounded-2xl inline-block mb-6">
                <Download className="text-emerald-400" size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Daily Reports</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                Download a comprehensive CSV export containing all settled table sessions from yesterday, including time, members, bill totals, and payment methods.
              </p>
              
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {downloading ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                <span>{downloading ? 'Preparing Export...' : 'Download Report'}</span>
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
