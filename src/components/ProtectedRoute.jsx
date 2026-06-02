import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/" replace />;
}

export function RoleRoute({ children, role }) {
  const { currentUser, userProfile } = useAuth();
  if (!currentUser) return <Navigate to="/" replace />;
  if (userProfile && userProfile.role !== role) {
    return <Navigate to={userProfile.role === "electrician" ? "/electrician/dashboard" : "/dashboard"} replace />;
  }
  return children;
}
