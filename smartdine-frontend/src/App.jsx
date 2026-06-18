import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import our separated page components
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import KDSPage from './pages/KDSPage';
import WaiterPage from './pages/WaiterPage';
import ReceptionPage from './pages/ReceptionPage';
import ManagerPage from './pages/ManagerPage';

// PrivateRoute wrapper to protect the dashboard
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const restaurantCode = localStorage.getItem('restaurantCode');

  // If there is no restaurant code, kick them back to the landing page to scan/type it
  if (!restaurantCode) {
    return <Navigate to="/" />;
  }

  // If there is no token, kick them to the login page
  if (!token) {
    return <Navigate to="/auth" />;
  }

  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing/Scan Page is default */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Public Auth Route */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Protected Dashboard Route */}
        <Route 
          path="/dashboard" 
          element = {
            <PrivateRoute>  
              <Dashboard />
            </PrivateRoute>
          } 
        />
        
        {/* Protected Kitchen Display System Route */}
        <Route 
          path="/kds" 
          element = {
            <PrivateRoute>  
              <KDSPage />
            </PrivateRoute>
          } 
        />

        {/* Protected Waiter Dashboard Route */}
        <Route 
          path="/waiter" 
          element = {
            <PrivateRoute>  
              <WaiterPage />
            </PrivateRoute>
          } 
        />

        {/* Protected Manager Dashboard Route */}
        <Route 
          path="/manager" 
          element = {
            <PrivateRoute>  
              <ManagerPage />
            </PrivateRoute>
          } 
        />

        {/* Reception QR Display Route */}
        <Route path="/reception/:code" element={<ReceptionPage />} />
      </Routes>
    </BrowserRouter>
  );
}