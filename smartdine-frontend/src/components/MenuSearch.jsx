import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, Loader2 } from 'lucide-react';

export default function MenuSearch({ onAddToCart, refreshTrigger }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingItems, setAddingItems] = useState({}); // Track loading state for individual items

  // Debounce the search query
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => {
      clearTimeout(timerId);
    };
  }, [query]);

  // Fetch menu based on debounced query or refresh trigger
  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      setError('');
      try {
        const endpoint = debouncedQuery.trim()
          ? `/api/menu/search?q=${encodeURIComponent(debouncedQuery)}`
          : '/api/menu';
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${endpoint}`);
        setMenuItems(data);
      } catch (err) {
        console.error('Failed to fetch menu', err);
        setError('Failed to load menu items.');
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [debouncedQuery, refreshTrigger]);

  const handleAddToCart = async (item) => {
    setAddingItems((prev) => ({ ...prev, [item._id]: true }));
    try {
      const token = localStorage.getItem('token');
      // Call the backend API to add to cart
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/cart/add`,
        { menuItemId: item._id },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      // We rely on the socket event to update the cart in the parent,
      // but we can also trigger a local callback if needed.
      if (onAddToCart) {
        onAddToCart(item);
      }
    } catch (err) {
      console.error('Failed to add item to cart', err);
      // Optional: show a toast or local error here
      alert(err.response?.data?.message || 'Failed to add item to cart');
    } finally {
      setAddingItems((prev) => ({ ...prev, [item._id]: false }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Menu</h2>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-colors"
            placeholder="Search for dishes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Menu List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && menuItems.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 p-4">{error}</div>
        ) : menuItems.length === 0 ? (
          <div className="text-center text-slate-500 p-8">
            No dishes found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {menuItems.map((item) => (
              <div
                key={item._id}
                className="flex justify-between items-center p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow bg-white group"
              >
                <div>
                  <h3 className="font-semibold text-slate-800">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-emerald-600 font-medium">${item.price.toFixed(2)}</span>
                    <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                      {item.category}
                    </span>
                  </div>
                  {item.stockQuantity <= 5 && item.stockQuantity > 0 && (
                    <p className="text-xs text-amber-500 mt-1 font-semibold flex items-center gap-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      Only {item.stockQuantity} left!
                    </p>
                  )}
                  {item.stockQuantity === 0 && (
                    <p className="text-xs text-red-500 mt-1 font-bold">Out of stock</p>
                  )}
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  disabled={item.stockQuantity === 0 || addingItems[item._id]}
                  className={`p-2 rounded-lg transition-colors ${
                    item.stockQuantity === 0 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700'
                  }`}
                  aria-label="Add to cart"
                >
                  {addingItems[item._id] ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Plus size={20} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
