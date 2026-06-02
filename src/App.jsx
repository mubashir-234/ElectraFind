import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute";

import Login from "./pages/Login";
import CustomerDashboard from "./pages/customer/Dashboard";
import BookElectrician from "./pages/customer/BookElectrician.jsx";
import MyBookings from "./pages/customer/MyBooking";
import ElectricianDashboard from "./pages/electrician/Dashboard";
import Chat from "./pages/chat.jsx";
// Load DM Sans font
const link = document.createElement("link");
link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,800&display=swap";
link.rel = "stylesheet";
document.head.appendChild(link);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: "#1a1a1a", color: "#fff", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 12, fontSize: 14 },
          duration: 4000,
        }} />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />

          {/* Customer routes */}
          <Route path="/dashboard" element={
            <RoleRoute role="customer"><CustomerDashboard /></RoleRoute>
          } />
          <Route path="/book/:id" element={
            <ProtectedRoute><BookElectrician /></ProtectedRoute>
          } />
          <Route path="/my-bookings" element={
            <RoleRoute role="customer"><MyBookings /></RoleRoute>
          } />

          {/* Electrician routes */}
          <Route path="/electrician/dashboard" element={
            <RoleRoute role="electrician"><ElectricianDashboard /></RoleRoute>
          } />

          <Route path="/chat/:chatId" element={
            <ProtectedRoute><Chat /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
