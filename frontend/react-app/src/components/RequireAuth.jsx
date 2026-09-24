import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireAuth({ children }) {
	const { user, initialized } = useAuth();

	if (!initialized) return null;
	if (!user) return <Navigate to="/login" replace />;

	if (user.role !== 'admin') return <Navigate to="/app" replace />;

	return children;
}