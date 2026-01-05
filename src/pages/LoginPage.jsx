import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900">
      <div className="text-center">
        {/* Logo and Title */}
        <div className="mb-8 p-3 scale-110">
          <div className="text-7xl mb-4 animate-bounce">☀️</div>
          <h1 className="text-5xl font-extrabold text-white mb-2 tracking-tight">
            Solar Architect
          </h1>
          <p className="text-blue-300 text-xl font-medium tracking-widest uppercase">Grid Master v5.0</p>
        </div>

        {/* Card */}
        <div className="bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-10 max-w-md w-full border border-gray-700/50">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400 mb-8">
            Sign in to design and simulate solar systems
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700/50 rounded-xl">
              <p className="text-red-200 text-sm flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading || isLoading}
            className="w-full px-8 py-4 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold rounded-xl transition-all flex items-center justify-center gap-4 group shadow-xl hover:shadow-white/10 active:scale-95"
          >
            <svg
              className="w-6 h-6 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {isLoading || loading ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing in...</span>
              </div>
            ) : (
              <span>Continue with Google</span>
            )}
          </button>

          {/* Info Text */}
          <div className="mt-10 pt-10 border-t border-gray-700/50">
            <p className="text-gray-500 text-xs mb-6 px-4 leading-relaxed">
              By signing in, you agree to our <span className="text-blue-400 hover:underline cursor-pointer">Terms of Service</span> and <span className="text-blue-400 hover:underline cursor-pointer">Privacy Policy</span>
            </p>
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div className="group">
                <div className="text-3xl mb-1 group-hover:scale-125 transition-transform">🎨</div>
                <p className="text-gray-500 font-bold uppercase tracking-tighter">Design</p>
              </div>
              <div className="group">
                <div className="text-3xl mb-1 group-hover:scale-125 transition-transform">📊</div>
                <p className="text-gray-500 font-bold uppercase tracking-tighter">Simulate</p>
              </div>
              <div className="group">
                <div className="text-3xl mb-1 group-hover:scale-125 transition-transform">💾</div>
                <p className="text-gray-500 font-bold uppercase tracking-tighter">Save</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12">
          <p className="text-gray-500 text-sm font-medium">
            Solar Architect © 2024 | <span className="text-gray-400">Developed by DeepMind Agentic Team</span>
          </p>
        </div>
      </div>
    </div>
  );
}
