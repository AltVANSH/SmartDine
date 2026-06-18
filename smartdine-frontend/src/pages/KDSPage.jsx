import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { ChefHat, Clock, Loader2, ArrowLeft, AlertCircle, Volume2, VolumeX, CheckSquare, Square, CheckCircle2, UtensilsCrossed, Settings } from 'lucide-react';
import InventoryModal from '../components/InventoryModal';

export default function KDSPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  
  const socketRef = useRef(null);

  // Time-ticking effect to refresh relative timestamps every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Play a premium ding-dong sound using standard Web Audio synthesizer
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // First tone (D5)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.15);

      // Second tone (A5)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // A5
      gain2.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.15);
      osc2.start(audioCtx.currentTime + 0.15);
      osc2.stop(audioCtx.currentTime + 0.35);
    } catch (err) {
      console.error('Audio chime failed:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/kds`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch KDS orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const token = localStorage.getItem('token');
    const socket = io(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}`, {
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('KDS socket connected');
      setSocketConnected(true);
      socket.emit('join_kitchen');
    });

    socket.on('disconnect', () => {
      console.log('KDS socket disconnected');
      setSocketConnected(false);
    });

    socket.on('order_received', (newOrder) => {
      console.log('New order received in KDS:', newOrder);
      setOrders(prev => {
        if (prev.some(o => o._id === newOrder._id)) return prev;
        return [...prev, newOrder];
      });
      playChime();
    });

    socket.on('kds_order_updated', (updatedOrder) => {
      console.log('Order status updated from another terminal:', updatedOrder);
      if (updatedOrder.status === 'Served') {
        setOrders(prev => prev.filter(o => o._id !== updatedOrder._id));
      } else {
        setOrders(prev => prev.map(o => o._id === updatedOrder._id ? updatedOrder : o));
      }
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const handleItemStatusUpdate = async (orderId, itemId, currentStatus) => {
    const nextStatusMap = {
      'Received': 'Preparing',
      'Preparing': 'Ready',
      'Ready': 'Ready' // Cannot go past Ready in KDS
    };

    const nextStatus = nextStatusMap[currentStatus];
    if (!nextStatus || nextStatus === currentStatus) return;

    // Optimistic UI update to remove perceived latency
    setOrders(prev => prev.map(o => {
      if (o._id === orderId) {
        const newItems = o.items.map(i => i._id === itemId ? { ...i, status: nextStatus } : i);
        
        // Optimistically calculate order's overall status
        const allServed = newItems.every(i => i.status === 'Served');
        const allReadyOrServed = newItems.every(i => i.status === 'Ready' || i.status === 'Served');
        const anyPreparingOrReady = newItems.some(i => i.status === 'Preparing' || i.status === 'Ready');
        
        let newOrderStatus = 'Received';
        if (allServed) newOrderStatus = 'Served';
        else if (allReadyOrServed) newOrderStatus = 'Ready';
        else if (anyPreparingOrReady) newOrderStatus = 'Preparing';

        return { ...o, items: newItems, status: newOrderStatus };
      }
      return o;
    }));

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/orders/${orderId}/items/${itemId}/status`, 
        { status: nextStatus }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error('Failed to update item status:', err);
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
      {/* Top Header Banner */}
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
            <ChefHat size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Kitchen Display System</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              {socketConnected ? 'Connected to Socket Server' : 'Offline - Reconnecting'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowInventoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Settings size={16} />
            <span>Manage Inventory</span>
          </button>
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              soundEnabled 
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' 
                : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
            }`}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            <span>Sound {soundEnabled ? 'ON' : 'MUTED'}</span>
          </button>
          <div className="bg-emerald-50 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 border border-emerald-100 flex items-center gap-2">
            <span>Orders: {orders.length}</span>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="h-96 flex flex-col justify-center items-center gap-3">
            <Loader2 className="animate-spin text-emerald-600" size={40} />
            <p className="text-slate-500 text-sm">Loading kitchen queue...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="h-96 flex flex-col justify-center items-center text-center">
            <div className="w-24 h-24 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mb-6 text-emerald-500 shadow-sm">
              <UtensilsCrossed size={48} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">No Pending Orders</h2>
            <p className="text-slate-500 text-base mt-2 max-w-sm leading-relaxed">
              All dishes have been prepared and served. Enjoy the quiet moment!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {orders.map((order) => {
              const elapsedMin = getElapsedMin(order.createdAt);
              const isWarning = elapsedMin >= 10 && elapsedMin < 15;
              const isUrgent = elapsedMin >= 15;
              
              const statusStyles = {
                'Received': 'bg-blue-50 border-blue-200 text-blue-700',
                'Preparing': 'bg-amber-50 border-amber-200 text-amber-700',
                'Ready': 'bg-emerald-50 border-emerald-200 text-emerald-700'
              };

              return (
                <div 
                  key={order._id}
                  className={`bg-white rounded-2xl border flex flex-col shadow-sm hover:shadow-md transition-all duration-300 ${
                    isUrgent ? 'border-red-300 ring-2 ring-red-500/20' :
                    isWarning ? 'border-amber-300 ring-2 ring-amber-500/20' :
                    'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex justify-between items-start gap-2">
                    <div>
                      <span className="text-2xl font-black tracking-tight text-slate-800">
                        Table {order.tableNumber}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        #{order._id.slice(-6).toUpperCase()}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyles[order.status]}`}>
                        {order.status}
                      </span>
                      <span className={`text-xs font-semibold flex items-center gap-1 ${
                        isUrgent ? 'text-red-600 font-bold' :
                        isWarning ? 'text-amber-600 font-bold' :
                        'text-slate-500'
                      }`}>
                        <Clock size={12} />
                        {getElapsedTimeStr(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Card Items List */}
                  <div className="flex-1 p-4 space-y-3">
                    {order.items.map((item) => {
                      const isReady = item.status === 'Ready';
                      const isPreparing = item.status === 'Preparing';
                      
                      return (
                        <div 
                          key={item._id}
                          onClick={() => handleItemStatusUpdate(order._id, item._id, item.status)}
                          className="flex items-start gap-3 cursor-pointer select-none group p-2 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                          <button className="mt-0.5 text-slate-400 group-hover:text-emerald-500 transition-colors">
                            {isReady ? (
                              <CheckCircle2 className="text-emerald-500" size={20} />
                            ) : isPreparing ? (
                              <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin"></div>
                            ) : (
                              <Square size={20} />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-semibold tracking-wide block mt-0.5 ${
                              isReady ? 'line-through text-slate-400' : 
                              isPreparing ? 'text-amber-700' : 'text-slate-700'
                            }`}>
                              {item.quantity}x {item.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Warning Indicator */}
                  {isUrgent && (
                    <div className="mx-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold mb-4 animate-pulse">
                      <AlertCircle size={16} />
                      <span>EXCEEDED 15 MINS! PREPARE ASAP!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showInventoryModal && (
        <InventoryModal onClose={() => setShowInventoryModal(false)} />
      )}
    </div>
  );
}
