import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Redirect to home page after successful login
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="flex items-center justify-center w-full h-screen bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
        <p className="text-white text-lg">Completing your sign in...</p>
      </div>
    </div>
  );
}
