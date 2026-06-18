import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Utensils, Clock, Loader2, LogOut, Check, CheckCircle2, Banknote } from 'lucide-react';

export default function WaiterPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'tables'
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [socketConnected, setSocketConnected] = useState(false);
  
  const socketRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    navigate('/');
  };

  const fetchOrdersAndTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const [ordersRes, tablesRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/waiter`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tables`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setOrders(ordersRes.data);
      setTables(tablesRes.data);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTables(data);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  useEffect(() => {
    fetchOrdersAndTables();

    const token = localStorage.getItem('token');
    const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}`, {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Waiter socket connected');
      setSocketConnected(true);
      socket.emit('join_waiter');
    });

    socket.on('disconnect', () => {
      console.log('Waiter socket disconnected');
      setSocketConnected(false);
    });

    socket.on('waiter_order_updated', (updatedOrder) => {
      console.log('Order updated for waiter:', updatedOrder);
      if (updatedOrder.status === 'Served') {
        setOrders(prev => prev.filter(o => o._id !== updatedOrder._id));
      } else {
        setOrders(prev => {
          if (prev.some(o => o._id === updatedOrder._id)) {
            return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
          }
          return [...prev, updatedOrder];
        });
      }
    });

    socket.on('table_status_changed', () => {
      fetchTables();
    });

    socket.on('cash_requested', () => {
      fetchTables();
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const handleServeOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/${orderId}/serve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(prev => prev.filter(o => o._id !== orderId));
    } catch (err) {
      console.error('Failed to serve order:', err);
    }
  };

  const handleUpdateTableStatus = async (tableId, newStatus) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/tables/${tableId}/status`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Wait for socket to refresh, or optimistically update
      fetchTables();
    } catch (err) {
      console.error('Failed to update table status:', err.response?.data?.message || err.message);
      alert(err.response?.data?.message || 'Failed to update table status');
    }
  };

  const handleConfirmCash = async (sessionId, userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/confirm-cash/${sessionId}/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchTables();
    } catch (err) {
      console.error('Failed to confirm cash:', err.response?.data?.message || err.message);
      alert(err.response?.data?.message || 'Failed to confirm cash payment');
    }
  };

  const getElapsedMin = (createdAt) => {
    const diffMs = now - new Date(createdAt).getTime();
    return Math.floor(diffMs / 60000);
  };

  const getElapsedTimeStr = (createdAt) => {
    const min = getElapsedMin(createdAt);
    if (min < 1) return 'Just now';
    return `${min} min ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
            <Utensils size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Waiter Dashboard</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              {socketConnected ? 'Connected to Kitchen & Reception' : 'Offline - Reconnecting'}
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active Orders
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tables' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Table Mgmt
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex bg-emerald-50 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 items-center gap-2 border border-emerald-100">
            <span>Orders to Serve: {orders.filter(o => o.status === 'Ready').length}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors text-slate-500 font-semibold text-sm"
            title="Sign Out"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3">
            <Loader2 className="animate-spin text-emerald-600" size={40} />
            <p className="text-slate-500 text-sm">Loading dashboard data...</p>
          </div>
        ) : activeTab === 'orders' ? (
          orders.length === 0 ? (
            <div className="h-96 flex flex-col justify-center items-center text-center">
              <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-500 shadow-inner">
                <CheckCircle2 size={38} />
              </div>
              <h2 className="text-2xl font-bold text-slate-700">No Pending Orders</h2>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                All dishes have been delivered and there are no active orders. Check back later!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {orders.map((order) => {
                const isReady = order.status === 'Ready';
                
                return (
                  <div 
                    key={order._id}
                    className={`bg-white rounded-2xl border flex flex-col shadow-sm transition-all duration-300 ${isReady ? 'border-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:shadow-md'}`}
                  >
                    <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl flex justify-between items-start gap-2">
                      <div>
                        <span className="text-2xl font-black tracking-tight text-slate-800">
                          Table {order.tableNumber}
                        </span>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          #{order._id.slice(-6).toUpperCase()}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          order.status === 'Received' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          order.status === 'Preparing' ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' :
                          'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          {order.status}
                        </span>
                        <span className={`text-xs font-semibold flex items-center gap-1 ${isReady ? 'text-emerald-600' : 'text-slate-500'}`}>
                          <Clock size={12} />
                          {isReady ? 'Ready for ' : 'Waiting '} {getElapsedTimeStr(order.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 p-4 space-y-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                          <div className="mt-1">
                            <Check size={16} className={isReady ? "text-emerald-500" : "text-slate-300"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-semibold tracking-wide ${isReady ? 'text-slate-700' : 'text-slate-500'}`}>
                              {item.quantity}x {item.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-white border-t border-slate-100 mt-auto rounded-b-2xl">
                      <button
                        onClick={() => handleServeOrder(order._id)}
                        disabled={!isReady}
                        className={`w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex justify-center items-center gap-1.5 shadow-sm ${
                          isReady 
                            ? 'text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
                            : 'text-slate-400 bg-slate-100 cursor-not-allowed'
                        }`}
                      >
                        {isReady ? <span>Mark as Served</span> : <span>Kitchen Preparing...</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map(table => {
              const isOccupied = table.status === 'occupied';
              const isCleaning = table.status === 'cleaning';
              const isAvailable = table.status === 'available';
              const isPaid = table.sessionStatus === 'completed';

              // Check if any users in the current session requested cash
              const cashRequests = [];
              if (table.paymentBreakdown) {
                Object.entries(table.paymentBreakdown).forEach(([uid, status]) => {
                  if (status.cash_requested && !status.paid) {
                    cashRequests.push(uid);
                  }
                });
              }
              const hasCashRequest = cashRequests.length > 0;

              return (
                <div key={table._id} className={`bg-white rounded-2xl border flex flex-col shadow-sm p-5 transition-all ${
                  isOccupied && isPaid ? 'border-amber-300 ring-2 ring-amber-500/20 bg-amber-50/10' :
                  isOccupied && hasCashRequest ? 'border-red-300 ring-2 ring-red-500/20 bg-red-50/10' :
                  isCleaning ? 'border-blue-300 ring-2 ring-blue-500/20 bg-blue-50/10' :
                  isAvailable ? 'border-emerald-200' : 'border-slate-200'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-3xl font-black text-slate-800">T{table.tableNumber}</h3>
                      <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">{table.capacity} Seats</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wider ${
                      isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      isCleaning ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      hasCashRequest ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' :
                      isPaid ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {isAvailable ? 'Available' : isCleaning ? 'Cleaning' : hasCashRequest ? 'Cash Request' : isPaid ? 'Paid & Leaving' : 'Occupied'}
                    </span>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                    {hasCashRequest && (
                      cashRequests.map(uid => (
                        <button 
                          key={uid}
                          onClick={() => handleConfirmCash(table.sessionId, uid)}
                          className="w-full py-2.5 rounded-xl font-bold text-xs uppercase text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors flex justify-center items-center gap-1"
                        >
                          <Banknote size={16} /> Confirm Cash Received
                        </button>
                      ))
                    )}
                    {isOccupied && !isPaid && !hasCashRequest && (
                      <button disabled className="w-full py-2.5 rounded-xl font-bold text-xs uppercase bg-slate-100 text-slate-400 cursor-not-allowed">
                        Guests Eating/Paying
                      </button>
                    )}
                    {isOccupied && isPaid && (
                      <button 
                        onClick={() => handleUpdateTableStatus(table._id, 'cleaning')}
                        className="w-full py-2.5 rounded-xl font-bold text-xs uppercase text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors"
                      >
                        Start Cleaning
                      </button>
                    )}
                    {isCleaning && (
                      <button 
                        onClick={() => handleUpdateTableStatus(table._id, 'available')}
                        className="w-full py-2.5 rounded-xl font-bold text-xs uppercase text-white bg-blue-500 hover:bg-blue-600 shadow-sm transition-colors"
                      >
                        Mark Vacant (Next Guest)
                      </button>
                    )}
                    {isAvailable && (
                      <button disabled className="w-full py-2.5 rounded-xl font-bold text-xs uppercase bg-emerald-50 text-emerald-500 cursor-not-allowed">
                        Ready for Guests
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
