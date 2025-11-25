import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../lib/auth";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          const isAuthorized = await authService.isEmailAuthorized(currentUser.email);
          if (!isAuthorized) {
            await authService.signOut();
            setUser(null);
            setProfile(null);
            setError("Access Denied: Your email is not authorized to access this system.");
          } else {
            const userProfile = await authService.getUserProfile();
            setProfile(userProfile);
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const subscription = authService.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          const isAuthorized = await authService.isEmailAuthorized(session.user.email);
          if (!isAuthorized) {
            await authService.signOut();
            setError("Access Denied: Your email is not authorized to access this system.");
          } else {
            setUser(session.user);
            const userProfile = await authService.getUserProfile();
            setProfile(userProfile);
            setError(null);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Periodic authorization check (every 5 minutes)
  useEffect(() => {
    if (!user) return;

    const checkInterval = setInterval(async () => {
      try {
        const isAuthorized = await authService.isEmailAuthorized(user.email);
        if (!isAuthorized) {
          console.warn("Periodic auth check failed. Signing out.");
          await authService.signOut();
          setUser(null);
          setProfile(null);
          setError("Access Denied: Authorization revoked.");
        }
      } catch (err) {
        console.error("Periodic auth check error:", err);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(checkInterval);
  }, [user]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      await authService.signInWithGoogle();
    } catch (err) {
      console.error("Sign in failed:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      await authService.signOut();
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error("Sign out failed:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
