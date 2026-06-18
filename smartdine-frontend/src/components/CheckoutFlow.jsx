import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, X, Receipt, CheckCircle, SplitSquareVertical, User, Users, Check, Banknote } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function StripePaymentForm({ myShareAmount, handlePaySuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      alert(error.message);
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      handlePaySuccess();
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-auto space-y-4">
      <PaymentElement />
      <button 
        type="submit"
        disabled={isProcessing || !stripe}
        className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 shadow-lg hover:shadow-xl focus:ring-4 focus:ring-slate-900/20 disabled:opacity-50"
      >
        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
        <span>{isProcessing ? 'Processing...' : `Pay $${myShareAmount.toFixed(2)}`}</span>
      </button>
    </form>
  );
}

export default function CheckoutFlow({ onClose, isHost, userId, refreshTrigger }) {
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/bill`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBill(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch bill.');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [refreshTrigger]);

  const handleSetTip = async (percentage) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/tip`, 
        { percentage }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set tip');
    }
  };

  const handleSetMethod = async (method) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/method`, 
        { method }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set method');
    }
  };

  const handlePaySuccess = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/pay`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPaymentSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update backend after payment');
    }
  };

  // Mock Handle Pay for zero-dollar amounts (guests when single payer is selected)
  const handleZeroPay = async () => {
    setProcessingPayment(true);
    await handlePaySuccess();
    setProcessingPayment(false);
  };

  const handleCashRequest = async () => {
    try {
      setProcessingPayment(true);
      const token = localStorage.getItem('token');
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/request-cash`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // The socket will update the bill automatically via refreshTrigger from Dashboard,
      // but we can also trigger a local refetch if we want.
      // For now, let's just let the socket handle it, or we could manually refresh:
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request cash payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-xl text-center">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
          <div className="text-red-500 mb-4 flex justify-center"><X size={48} /></div>
          <h2 className="text-2xl font-bold text-slate-800">Error</h2>
          <p className="text-slate-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const hasSelectedMethod = bill.paymentSplitMethod !== 'unselected';
  const myPaymentStatus = bill.paymentBreakdown[userId];
  const amIPaid = myPaymentStatus?.paid;
  const cashRequested = myPaymentStatus?.cash_requested;

  // Calculate my share based on the selected method
  let myShareAmount = 0;
  if (bill.paymentSplitMethod === 'split_evenly') {
    myShareAmount = bill.splitEvenlyPerHead;
  } else if (bill.paymentSplitMethod === 'single_payer') {
    myShareAmount = isHost ? bill.grandTotal : 0;
  } else if (bill.paymentSplitMethod === 'itemized') {
    myShareAmount = bill.itemizedByUser[userId]?.total || 0;
  }

  // Effect to fetch clientSecret if needed
  if (hasSelectedMethod && myShareAmount > 0 && !amIPaid && !cashRequested && !paymentSuccess && !clientSecret) {
    const getSecret = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payment/create-payment-intent`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClientSecret(data.clientSecret);
      } catch(err) {
        console.error("Failed to get client secret", err);
      }
    };
    getSecret();
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full relative shadow-2xl flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        
        {/* Left Side: The Bill Summary */}
        <div className="w-full md:w-1/2 bg-slate-50 p-8 border-r border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <Receipt size={24} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Table Receipt</h2>
          </div>

          <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
            {bill.orders.map(order => (
              order.items.map(item => (
                <div key={item._id} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-semibold text-slate-700">{item.quantity}x {item.name}</span>
                    <p className="text-xs text-slate-400">Added by {item.addedBy?.name || 'Unknown'}</p>
                  </div>
                  <span className="font-medium text-slate-600">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))
            ))}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span>${bill.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tax (10%)</span>
              <span>${bill.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>Tip ({bill.tipPercentage}%)</span>
              <span>${bill.tipAmount?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between text-xl font-black text-slate-800 mt-2 pt-2 border-t border-slate-200">
              <span>Grand Total</span>
              <span>${bill.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Split Selection or Payment */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-center relative bg-white">
          <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors z-10">
            <X size={24} />
          </button>

          {!hasSelectedMethod ? (
            // SPLIT METHOD SELECTION
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">How would you like to pay?</h3>
              
              {isHost ? (
                <>
                  {/* Tip Selection */}
                  <div className="mb-6 border-b border-slate-100 pb-6">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Add a Tip</h4>
                    <div className="flex gap-2">
                      {[0, 15, 18, 20].map(tip => (
                        <button
                          key={tip}
                          onClick={() => handleSetTip(tip)}
                          className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all border ${
                            bill.tipPercentage === tip
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200'
                          }`}
                        >
                          {tip === 0 ? 'None' : `${tip}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Method Selection */}
                  <div className="space-y-4">
                    <button onClick={() => handleSetMethod('split_evenly')} className="w-full p-4 border-2 border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 flex items-center gap-4 transition-all text-left group">
                      <div className="bg-slate-100 group-hover:bg-emerald-100 p-3 rounded-xl text-slate-600 group-hover:text-emerald-600 transition-colors"><Users size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-800">Split Evenly</h4>
                        <p className="text-xs text-slate-500">Everyone pays exactly ${bill.splitEvenlyPerHead.toFixed(2)}</p>
                      </div>
                    </button>
                    
                    <button onClick={() => handleSetMethod('itemized')} className="w-full p-4 border-2 border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 flex items-center gap-4 transition-all text-left group">
                      <div className="bg-slate-100 group-hover:bg-emerald-100 p-3 rounded-xl text-slate-600 group-hover:text-emerald-600 transition-colors"><SplitSquareVertical size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-800">Pay by Item</h4>
                        <p className="text-xs text-slate-500">Pay only for what you ordered</p>
                      </div>
                    </button>

                    <button onClick={() => handleSetMethod('single_payer')} className="w-full p-4 border-2 border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 flex items-center gap-4 transition-all text-left group">
                      <div className="bg-slate-100 group-hover:bg-emerald-100 p-3 rounded-xl text-slate-600 group-hover:text-emerald-600 transition-colors"><User size={24} /></div>
                      <div>
                        <h4 className="font-bold text-slate-800">I'll Cover It All</h4>
                        <p className="text-xs text-slate-500">Host pays the full ${bill.grandTotal.toFixed(2)}</p>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Loader2 className="animate-spin text-emerald-500 mx-auto mb-4" size={40} />
                  <p className="text-slate-500 font-medium">Waiting for the host to select a split method...</p>
                </div>
              )}
            </div>
          ) : (
            // PAYMENT SETTLEMENT
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col h-full">
              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full mb-3 inline-block">
                  {bill.paymentSplitMethod.replace('_', ' ')}
                </span>
                <h3 className="text-2xl font-bold text-slate-800">Your Share</h3>
                <div className="text-5xl font-black text-emerald-600 my-2">${myShareAmount.toFixed(2)}</div>
                
                {bill.paymentSplitMethod === 'itemized' && bill.itemizedByUser[userId] && (
                  <p className="text-xs text-slate-500 font-medium">Includes ${(bill.itemizedByUser[userId].taxShare).toFixed(2)} tax and ${(bill.itemizedByUser[userId].tipShare).toFixed(2)} tip.</p>
                )}
              </div>

              {amIPaid || paymentSuccess ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center mt-auto shadow-sm">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-emerald-800 mb-1">You're all set!</h4>
                  <p className="text-emerald-600 text-sm font-medium">Waiting for others to finish paying...</p>
                </div>
              ) : cashRequested ? (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center mt-auto shadow-sm">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Banknote size={32} />
                  </div>
                  <h4 className="text-xl font-bold text-amber-800 mb-1">Cash Requested</h4>
                  <p className="text-amber-600 text-sm font-medium">Please wait. A waiter is on their way to collect your cash.</p>
                </div>
              ) : myShareAmount === 0 ? (
                <div className="mt-auto">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center shadow-sm mb-4">
                    <p className="text-emerald-600 text-sm font-medium">Your share is covered by the host!</p>
                  </div>
                  <button 
                    onClick={handleZeroPay}
                    disabled={processingPayment}
                    className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex justify-center items-center gap-2 shadow-lg hover:shadow-xl focus:ring-4 focus:ring-slate-900/20"
                  >
                    {processingPayment ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                    <span>Acknowledge</span>
                  </button>
                </div>
              ) : (
                <div className="mt-auto">
                  {clientSecret ? (
                    <div className="space-y-4">
                      <Elements stripe={stripePromise} options={{ clientSecret }}>
                        <StripePaymentForm myShareAmount={myShareAmount} handlePaySuccess={handlePaySuccess} />
                      </Elements>
                      
                      <div className="relative flex items-center justify-center">
                        <div className="absolute border-t border-slate-200 w-full"></div>
                        <span className="bg-white px-3 text-xs text-slate-400 relative font-medium uppercase tracking-wider">Or</span>
                      </div>

                      <button 
                        onClick={handleCashRequest}
                        disabled={processingPayment}
                        className="w-full py-4 rounded-xl font-bold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors flex justify-center items-center gap-2"
                      >
                        {processingPayment ? <Loader2 className="animate-spin" size={20} /> : <Banknote size={20} />}
                        <span>Pay with Cash</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-center p-8">
                      <Loader2 className="animate-spin text-emerald-500" size={32} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
