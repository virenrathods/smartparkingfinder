import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleGuard from './components/common/RoleGuard';

// User Pages
import Home from './pages/Home';
import Explore from './pages/Explore';
import LocationDetails from './pages/LocationDetails';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageLocations from './pages/admin/ManageLocations';
import ManageSlots from './pages/admin/ManageSlots';
import ManageBookings from './pages/admin/ManageBookings';
import Reports from './pages/admin/Reports';

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/locations/:id" element={<LocationDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* User Protected Routes */}
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* Administrator Protected Routes */}
          <Route
            path="/admin"
            element={
              <RoleGuard requiredRole="admin">
                <AdminDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/locations"
            element={
              <RoleGuard requiredRole="admin">
                <ManageLocations />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/slots"
            element={
              <RoleGuard requiredRole="admin">
                <ManageSlots />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <RoleGuard requiredRole="admin">
                <ManageBookings />
              </RoleGuard>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RoleGuard requiredRole="admin">
                <Reports />
              </RoleGuard>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
