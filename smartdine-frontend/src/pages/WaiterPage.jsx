import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Utensils, Clock, Loader2, ArrowLeft, Check, CheckCircle2 } from 'lucide-react';

export default function WaiterPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [socketConnected, setSocketConnected] = useState(false);
  
  const socketRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:5000/api/orders/waiter', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch Waiter orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const token = localStorage.getItem('token');
    const socket = io('http://localhost:5000', {
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
      } else if (updatedOrder.status === 'Ready') {
        setOrders(prev => {
          if (prev.some(o => o._id === updatedOrder._id)) return prev;
          return [...prev, updatedOrder];
        });
      }
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const handleServeOrder = async (orderId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/orders/${orderId}/serve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(prev => prev.filter(o => o._id !== orderId));
    } catch (err) {
      console.error('Failed to serve order:', err);
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
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500 hover:text-slate-700"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
            <Utensils size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Waiter Dashboard</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              {socketConnected ? 'Connected to Kitchen' : 'Offline - Reconnecting'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-emerald-50 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2 border border-emerald-100">
            <span>Orders to Serve: {orders.length}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3">
            <Loader2 className="animate-spin text-emerald-600" size={40} />
            <p className="text-slate-500 text-sm">Loading delivery queue...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="h-96 flex flex-col justify-center items-center text-center">
            <div className="w-20 h-20 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-500 shadow-inner">
              <CheckCircle2 size={38} />
            </div>
            <h2 className="text-2xl font-bold text-slate-700">No Orders to Serve</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              All prepared dishes have been delivered. Check back later!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {orders.map((order) => {
              return (
                <div 
                  key={order._id}
                  className="bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300"
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
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                        {order.status}
                      </span>
                      <span className="text-xs font-semibold flex items-center gap-1 text-amber-600">
                        <Clock size={12} />
                        Waiting {getElapsedTimeStr(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-4 space-y-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="mt-1">
                          <Check size={16} className="text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold tracking-wide text-slate-700">
                            {item.quantity}x {item.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-white border-t border-slate-100 mt-auto rounded-b-2xl">
                    <button
                      onClick={() => handleServeOrder(order._id)}
                      className="w-full py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all flex justify-center items-center gap-1.5 shadow-sm"
                    >
                      <span>Mark as Served</span>
                    </button>
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
