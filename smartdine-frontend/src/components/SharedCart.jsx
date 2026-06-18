import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingBag, Trash2, Loader2, Users } from 'lucide-react';

export default function SharedCart({ refreshTrigger, onOrderPlaced }) {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingItems, setRemovingItems] = useState({});
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  const handleSendOrder = async () => {
    setSubmittingOrder(true);
    setOrderError('');
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/orders',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onOrderPlaced) {
        onOrderPlaced();
      }
    } catch (err) {
      setOrderError(err.response?.data?.message || 'Failed to send order.');
      console.error(err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const fetchCart = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const { data } = await axios.get('http://localhost:5000/api/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCartItems(data);
    } catch (err) {
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [refreshTrigger]);

  const handleRemove = async (menuItemId) => {
    setRemovingItems(prev => ({ ...prev, [menuItemId]: true }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/cart/remove',
        { menuItemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // The backend will emit 'cart_updated' which will trigger refreshTrigger
    } catch (err) {
      console.error('Failed to remove item:', err);
    } finally {
      setRemovingItems(prev => ({ ...prev, [menuItemId]: false }));
    }
  };

  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-emerald-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-emerald-600" size={24} />
          <h2 className="text-xl font-bold text-emerald-900">Shared Cart</h2>
        </div>
        <div className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
          <Users size={14} /> Live
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
        {loading && cartItems.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : cartItems.length === 0 ? (
          <div className="text-center text-slate-500 p-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingBag className="text-slate-400" size={32} />
            </div>
            <p className="font-medium">Your table's cart is empty.</p>
            <p className="text-sm mt-1">Add dishes from the menu to start ordering together.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cartItems.map((item) => (
              <div key={item.menuItemId} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex justify-between">
                    <h4 className="font-bold text-slate-800">{item.name}</h4>
                    <span className="font-semibold text-emerald-600">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md font-medium">
                        Qty: {item.quantity}
                      </span>
                      <span className="text-xs text-slate-400">
                        Added by {item.addedBy?.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemove(item.menuItemId)}
                      disabled={removingItems[item.menuItemId]}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      aria-label="Remove item"
                    >
                      {removingItems[item.menuItemId] ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Total */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-500 font-medium">Table Total</span>
          <span className="text-2xl font-black text-slate-800">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={handleSendOrder}
          disabled={cartItems.length === 0 || submittingOrder}
          className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submittingOrder ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              <span>Sending Order...</span>
            </>
          ) : (
            <span>Send Order to Kitchen</span>
          )}
        </button>
        {orderError && (
          <p className="text-red-500 text-xs mt-2 text-center font-semibold">{orderError}</p>
        )}
      </div>
    </div>
  );
}
