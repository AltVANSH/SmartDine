import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2, Save, AlertCircle } from 'lucide-react';

export default function InventoryModal({ onClose }) {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/menu`);
      setMenuItems(data);
    } catch (err) {
      setError('Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = (id, newStock) => {
    setMenuItems(prev => prev.map(item => 
      item._id === id ? { ...item, stockQuantity: Math.max(0, parseInt(newStock) || 0) } : item
    ));
  };

  const handleToggleAvailability = (id, currentStatus) => {
    setMenuItems(prev => prev.map(item => 
      item._id === id ? { ...item, isAvailable: !currentStatus } : item
    ));
  };

  const handleSave = async (item) => {
    setSavingItem(item._id);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/menu/${item._id}/inventory`, 
        { 
          stockQuantity: item.stockQuantity,
          isAvailable: item.isAvailable
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Optional: Show success tick
    } catch (err) {
      alert('Failed to update inventory for ' + item.name);
    } finally {
      setSavingItem(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Inventory Management</h2>
            <p className="text-sm text-slate-500 mt-1">Update live stock quantities. Changes instantly reflect on the customer menu.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-700 flex items-center gap-2 rounded-xl">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="animate-spin text-emerald-600" size={32} />
            </div>
          ) : (
            <div className="space-y-4">
              {menuItems.map(item => (
                <div key={item._id} className={`flex items-center justify-between p-4 border rounded-2xl transition-all ${item.stockQuantity === 0 || !item.isAvailable ? 'bg-red-50/30 border-red-100' : 'bg-white border-slate-200'}`}>
                  
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-slate-500 px-2 py-0.5 bg-slate-100 rounded-md uppercase tracking-wider">{item.category}</span>
                      {item.stockQuantity <= 5 && item.stockQuantity > 0 && (
                        <span className="text-xs font-bold text-amber-600">Low Stock</span>
                      )}
                      {(item.stockQuantity === 0 || !item.isAvailable) && (
                        <span className="text-xs font-bold text-red-600">Out of Stock</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Availability Toggle */}
                    <label className="flex items-center cursor-pointer gap-2">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only"
                          checked={item.isAvailable}
                          onChange={() => handleToggleAvailability(item._id, item.isAvailable)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${item.isAvailable ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${item.isAvailable ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-semibold text-slate-600 w-16">
                        {item.isAvailable ? 'Active' : 'Hidden'}
                      </span>
                    </label>

                    {/* Stock Input */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-500">Qty:</span>
                      <input 
                        type="number" 
                        min="0"
                        value={item.stockQuantity}
                        onChange={(e) => handleStockChange(item._id, e.target.value)}
                        className="w-20 px-3 py-2 text-center font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
                      />
                    </div>

                    {/* Save Button */}
                    <button 
                      onClick={() => handleSave(item)}
                      disabled={savingItem === item._id}
                      className="flex items-center justify-center w-24 gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                      {savingItem === item._id ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Save</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
