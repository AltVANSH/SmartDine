import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, LogOut, QrCode, User, ArrowRight, X, Loader2, Clipboard, Users, Check, Receipt } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import MenuSearch from '../components/MenuSearch';
import SharedCart from '../components/SharedCart';
import CheckoutFlow from '../components/CheckoutFlow';

export default function Dashboard() {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Guest';

  // --- SESSION & QUEUE STATES ---
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle' | 'waiting' | 'seated'
  const [activeSession, setActiveSession] = useState(null);
  const [activeQueue, setActiveQueue] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const socketRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [cartRefreshTrigger, setCartRefreshTrigger] = useState(0);
  const [activeOrders, setActiveOrders] = useState([]);

  // --- NEW STATE VARIABLES FOR MODAL ---
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [partySize, setPartySize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinResult, setJoinResult] = useState(null);

  // --- CHECKOUT & BILL STATE ---
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentRefreshTrigger, setPaymentRefreshTrigger] = useState(0);

  // --- JOIN TABLE (BY INVITE CODE) STATE VARIABLES ---
  const [showJoinTableModal, setShowJoinTableModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinTableResult, setJoinTableResult] = useState(null);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('restaurantCode');
    navigate('/');
  };

  const fetchActiveOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const { data } = await axios.get('http://localhost:5000/api/orders/session', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActiveOrders(data);
    } catch (err) {
      console.error('Failed to fetch active orders:', err);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const { data } = await axios.get('http://localhost:5000/api/queue/current-session', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.status === 'seated') {
        setSessionStatus('seated');
        setActiveSession(data.session);
        setParticipants(data.session.participants || []);
        fetchActiveOrders();
      } else if (data.status === 'waiting') {
        setSessionStatus('waiting');
        setActiveQueue(data.queue);
      } else {
        setSessionStatus('idle');
      }
    } catch (err) {
      console.error('Error fetching session status:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchCurrentSession();
      setLoadingStatus(false);
    };
    init();
  }, []);

  const sessionId = activeSession?._id;

  useEffect(() => {
    if (sessionStatus === 'seated' && sessionId) {
      const token = localStorage.getItem('token');
      const socket = io('http://localhost:5000', {
        auth: { token }
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Connected to socket server');
        socket.emit('join_table', { sessionId });
      });

      socket.on('user_joined', ({ userId }) => {
        console.log('A user joined the table room:', userId);
        fetchCurrentSession();
      });

      socket.on('cart_updated', () => {
        console.log('Cart updated via socket');
        setCartRefreshTrigger(prev => prev + 1);
      });

      socket.on('menu_updated', () => {
        console.log('Menu stock updated globally');
        setCartRefreshTrigger(prev => prev + 1);
      });

      socket.on('order_status_updated', ({ orderId, status }) => {
        console.log(`Order status updated for ${orderId}: ${status}`);
        fetchActiveOrders();
      });

      socket.on('checkout_initiated', (data) => {
        console.log('Checkout initiated:', data);
        setShowCheckout(true);
        setPaymentRefreshTrigger(prev => prev + 1);
      });

      socket.on('payment_updated', () => {
        setPaymentRefreshTrigger(prev => prev + 1);
      });

      socket.on('session_closed', (data) => {
        alert(data.message || 'Session closed');
        setShowCheckout(false);
        window.location.reload();
      });

      socket.on('error_message', (msg) => {
        console.error('Socket error:', msg);
      });

      return () => {
        if (socket) socket.disconnect();
      };
    }
  }, [sessionStatus, sessionId]);

  const copyInviteLink = () => {
    if (!activeSession) return;
    navigator.clipboard.writeText(activeSession.joinCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // --- NEW FUNCTION TO API CALL ---
  const handleJoinQueue = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        'http://localhost:5000/api/queue/join',
        { partySize: Number(partySize) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setJoinResult(data);
      await fetchCurrentSession();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join queue. Is backend running?');
    } finally {
      setLoading(false);
    }
  };

  // --- NEW FUNCTION TO API CALL FOR JOINING TABLE ---
  const handleJoinTable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        'http://localhost:5000/api/queue/join-table',
        { joinCode: joinCode.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setJoinTableResult(data);
      await fetchCurrentSession();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join table. Check invite code.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

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
        
        <div className="flex items-center gap-4">
          {sessionStatus === 'seated' && (
            <button 
              onClick={() => setShowCheckout(true)}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Receipt size={18} />
              <span className="hidden sm:inline">Checkout / View Bill</span>
            </button>
          )}
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto p-6 mt-6">
        {sessionStatus === 'idle' && (
          <>
            <header className="mb-10">
              <h1 className="text-3xl font-bold text-slate-800">Welcome, {userName}!</h1>
              <p className="text-slate-500 mt-2">You are not currently seated at a table.</p>
            </header>

            {/* Action Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {/* Join Queue Card */}
              <div 
                onClick={() => setShowJoinModal(true)}
                className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
              >
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
              <div 
                onClick={() => setShowJoinTableModal(true)}
                className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
              >
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
          </>
        )}

        {sessionStatus === 'waiting' && activeQueue && (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center mt-10">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Users className="text-amber-600" size={38} />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">You are in the queue!</h2>
            <p className="text-slate-500 mb-6 text-sm">
              We are preparing a table matching your party size of <strong className="text-slate-800">{activeQueue.partySize}</strong>.
            </p>

            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-6 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block mb-1">
                Estimated Wait Time
              </span>
              <strong className="text-4xl font-black text-amber-700">
                {activeQueue.estimatedWaitTimeMins} <span className="text-lg font-medium">mins</span>
              </strong>
            </div>

            <p className="text-xs text-slate-400 font-medium">
              We will automatically notify you and seat you once your table is ready.
            </p>
          </div>
        )}

        {sessionStatus === 'seated' && activeSession && (
          <>
            <div className="grid md:grid-cols-3 gap-6 mt-6">
              
              {/* Table Details Card */}
              <div className="md:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="bg-emerald-100 text-emerald-800 font-bold text-xs uppercase tracking-widest px-3 py-1 rounded-full">
                      Active Session
                    </span>
                    <h1 className="text-4xl font-extrabold text-slate-800 mt-3">
                      Table {activeSession.tableNumber}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">{activeSession.hotelName}</p>
                  </div>
                  <div className="bg-emerald-600 p-3 rounded-2xl text-white">
                    <ChefHat size={32} />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 mt-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Users size={16} /> Seated Guests ({participants.length})
                  </h3>
                  <div className="space-y-3">
                    {participants.map((participant) => {
                      const isHost = participant._id === activeSession.hostId._id;
                      return (
                        <div 
                          key={participant._id} 
                          className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold uppercase">
                              {participant.name.slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700 block text-sm">{participant.name}</span>
                              <span className="text-xs text-slate-400">{participant.email}</span>
                            </div>
                          </div>
                          {isHost ? (
                            <span className="bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-200">
                              Host
                            </span>
                          ) : (
                            <span className="bg-slate-200 text-slate-600 font-medium text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                              Guest
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Invite Details + Active Orders */}
              <div className="flex flex-col gap-6">
                {/* Invite Details Card */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col justify-between h-fit">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Invite Friends</h3>
                    <p className="text-slate-500 text-xs leading-relaxed mb-6">
                      Share this unique code with your friends so they can join this table and build the cart together.
                    </p>

                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 text-center mb-6">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                        Invite Code
                      </span>
                      <span className="text-3xl font-black tracking-widest text-emerald-700 uppercase font-mono">
                        {activeSession.joinCode}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={copyInviteLink}
                    className={`w-full py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                      copySuccess 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check size={20} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Clipboard size={20} />
                        <span>Copy Invite Code</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Active Orders Tracker Card */}
                {activeOrders.length > 0 && (
                  <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <ChefHat className="text-emerald-600" size={20} />
                      Active Orders ({activeOrders.length})
                    </h3>
                    <div className="space-y-6 max-h-[300px] overflow-y-auto pr-1">
                      {activeOrders.map((order) => {
                        const getStatusStep = (status) => {
                          switch (status) {
                            case 'Received': return 0;
                            case 'Preparing': return 1;
                            case 'Ready': return 2;
                            case 'Served': return 3;
                            default: return 0;
                          }
                        };
                        const steps = ['Received', 'Preparing', 'Ready'];
                        const currentStep = getStatusStep(order.status);
                        
                        return (
                          <div key={order._id} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-slate-400">
                                ORDER #{order._id.slice(-4).toUpperCase()}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                order.status === 'Received' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                order.status === 'Preparing' ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' :
                                order.status === 'Ready' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                                'bg-slate-50 text-slate-600'
                              }`}>
                                {order.status}
                              </span>
                            </div>

                            {/* Visual Progress Steps */}
                            <div className="flex items-center justify-between my-4 relative px-2">
                              <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
                              <div 
                                className="absolute left-4 top-1/2 h-0.5 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
                                style={{ width: `${currentStep === 0 ? 0 : currentStep === 1 ? 50 : 100}%` }}
                              ></div>
                              
                              {steps.map((step, sIdx) => {
                                const isCompleted = currentStep > sIdx;
                                const isActive = currentStep === sIdx;
                                return (
                                  <div key={step} className="flex flex-col items-center z-10">
                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300 ${
                                      isCompleted ? 'bg-emerald-500 text-white' :
                                      isActive ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50 border border-emerald-300' : 
                                      'bg-white text-slate-400 border border-slate-200'
                                    }`}>
                                      {isCompleted ? <Check size={10} /> : sIdx + 1}
                                    </div>
                                    <span className={`text-[9px] font-bold mt-1 ${
                                      isActive ? 'text-emerald-700' : 'text-slate-400'
                                    }`}>
                                      {step}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Items list */}
                            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1 mt-2">
                              {order.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between">
                                  <span>{item.quantity}x {item.name}</span>
                                  <span className="text-slate-400 font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Menu and Cart Grid */}
            <div className="grid md:grid-cols-3 gap-6 mt-6 h-[600px] mb-10">
              <div className="md:col-span-2 h-full">
                <MenuSearch onAddToCart={() => setCartRefreshTrigger(prev => prev + 1)} refreshTrigger={cartRefreshTrigger} />
              </div>
              <div className="h-full">
                <SharedCart refreshTrigger={cartRefreshTrigger} onOrderPlaced={fetchActiveOrders} />
              </div>
            </div>
          </>
        )}
      </main>

      {}
      {/* --- NEW JOIN RESTAURANT MODAL UI --- */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-xl">
            
            {/* Close Button */}
            <button 
              onClick={() => { setShowJoinModal(false); setJoinResult(null); setError(''); }} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
            
            {!joinResult ? (
              /* State 1: Entering Party Size */
              <>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to The Grand Taj!</h2>
                <p className="text-slate-500 mb-6">How many people in your party?</p>
                
                {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
                
                <form onSubmit={handleJoinQueue}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Party Size</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="20"
                    value={partySize} 
                    onChange={(e) => setPartySize(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-slate-50 mb-6 transition-colors"
                  />
                  <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-xl hover:bg-emerald-700 flex justify-center items-center gap-2 transition-colors">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Find Table'}
                  </button>
                </form>
              </>
            ) : (
              /* State 2: Success! Show Table Info or Waitlist Info */
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChefHat className="text-emerald-600" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{joinResult.message}</h2>
                
                {joinResult.session ? (
                  <p className="text-slate-600 mb-6">
                    You have been assigned <strong className="text-slate-800">Table {joinResult.session.tableNumber}</strong>.<br/><br/>
                    Share this code with your friends so they can join your cart:<br/>
                    <strong className="text-emerald-600 text-2xl tracking-widest mt-2 block">{joinResult.session.joinCode}</strong>
                  </p>
                ) : (
                  <p className="text-slate-600 mb-6">
                    Estimated Wait Time: <strong className="text-emerald-600 text-xl block mt-2">{joinResult.queue.estimatedWaitTimeMins} mins</strong>
                  </p>
                )}
                
                <button onClick={() => setShowJoinModal(false)} className="w-full bg-slate-100 text-slate-700 font-semibold py-3.5 rounded-xl hover:bg-slate-200 transition-colors">
                  Close & Go to Menu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- NEW JOIN TABLE MODAL UI --- */}
      {showJoinTableModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-xl">
            
            {/* Close Button */}
            <button 
              onClick={() => { setShowJoinTableModal(false); setJoinTableResult(null); setError(''); setJoinCode(''); }} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={24} />
            </button>
            
            {!joinTableResult ? (
              /* State 1: Entering Join Code */
              <>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Join a Table</h2>
                <p className="text-slate-500 mb-6">Enter the 6-character code shared by your friend.</p>
                
                {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
                
                <form onSubmit={handleJoinTable}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Invite Code</label>
                  <input 
                    type="text" 
                    maxLength="6"
                    placeholder="e.g. A1B2C3"
                    value={joinCode} 
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-slate-50 mb-6 uppercase text-center font-bold tracking-widest text-lg transition-colors"
                  />
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 transition-colors">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Join Table'}
                  </button>
                </form>
              </>
            ) : (
              /* State 2: Success! Seated at Table */
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="text-blue-600" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{joinTableResult.message}</h2>
                <p className="text-slate-600 mb-6">
                  You are now seated at <strong className="text-slate-800">Table {joinTableResult.session?.tableNumber}</strong>.
                </p>
                
                <button onClick={() => { setShowJoinTableModal(false); setJoinCode(''); setJoinTableResult(null); }} className="w-full bg-slate-100 text-slate-700 font-semibold py-3.5 rounded-xl hover:bg-slate-200 transition-colors">
                  Close & Go to Menu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CHECKOUT FLOW MODAL --- */}
      {showCheckout && (
        <CheckoutFlow
          onClose={() => setShowCheckout(false)}
          isHost={activeSession?.hostId?._id === localStorage.getItem('userId') || activeSession?.hostId === localStorage.getItem('userId')}
          userId={localStorage.getItem('userId')}
          refreshTrigger={paymentRefreshTrigger}
        />
      )}
    </div>
  );
}