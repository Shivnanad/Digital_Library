import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuthUser({ children }) {
  const { user, initialized } = useAuth();
  if (!initialized) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
