import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ChefHat, Smartphone } from 'lucide-react';

export default function ReceptionPage() {
  const { code } = useParams();
  
  // If no code is provided in the URL, we could show an error or redirect
  if (!code) {
    return <Navigate to="/" />;
  }

  const restaurantCode = code.toUpperCase();
  const scanUrl = `${window.location.origin}/?code=${restaurantCode}`;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8 font-sans">
      <div className="max-w-4xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Branding & Instructions */}
        <div className="w-full md:w-1/2 bg-emerald-600 p-12 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent"></div>
          
          <div className="relative z-10">
            <div className="bg-white/20 p-4 rounded-2xl inline-block mb-8 backdrop-blur-sm">
              <ChefHat size={48} className="text-white" />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tight leading-tight">Welcome to <br/>The Taj</h1>
            <p className="text-emerald-100 text-lg mb-8 max-w-sm">
              Skip the wait. Scan the QR code with your phone's camera to join the waitlist, browse the menu, and order directly to your table.
            </p>
            
            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm">
              <Smartphone size={32} className="text-emerald-200" />
              <div>
                <p className="font-bold">No app required</p>
                <p className="text-emerald-200 text-sm">Uses your native camera</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Code Display */}
        <div className="w-full md:w-1/2 p-12 flex flex-col items-center justify-center bg-slate-50 relative">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 mb-8 transform transition-transform hover:scale-105">
            <QRCodeSVG 
              value={scanUrl} 
              size={300} 
              level={"H"}
              includeMargin={true}
              fgColor={"#0f172a"}
            />
          </div>
          
          <div className="text-center">
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-2">Camera broken?</p>
            <p className="text-slate-400 text-sm mb-2">Go to <span className="font-bold text-emerald-600">{window.location.host}</span> and enter code:</p>
            <div className="text-4xl font-black text-slate-800 tracking-[0.2em] bg-slate-200/50 py-3 px-6 rounded-2xl border border-slate-200">
              {restaurantCode}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
