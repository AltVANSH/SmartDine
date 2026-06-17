import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import our separated page components
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';

// PrivateRoute wrapper to protect the dashboard
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  // If there is no token, kick them back to the login page
  return token ? children : <Navigate to="/auth" />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirects to auth */}
        <Route path="/" element={<Navigate to="/auth" />} />
        
        {/* Public Route */}
        <Route path="/auth" element={<AuthPage />} />
        
        {/* Protected Route */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>  
              <Dashboard />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}