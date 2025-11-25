import { supabase } from "./supabase";

export const authService = {
  // Sign in with Google
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  // Get current user
  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        // AuthSessionMissingError is expected when no user is logged in
        if (error.name === "AuthSessionMissingError") {
          return null;
        }
        console.error("Error getting user:", error);
        return null;
      }

      return user;
    } catch (err) {
      // Handle any other errors gracefully
      return null;
    }
  },

  // Get session
  async getSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        // AuthSessionMissingError is expected when no user is logged in
        if (error.name === "AuthSessionMissingError") {
          return null;
        }
        console.error("Error getting session:", error);
        return null;
      }

      return session;
    } catch (err) {
      // Handle any other errors gracefully
      return null;
    }
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    return true;
  },

  // Listen to auth state changes
  onAuthStateChange(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return subscription;
  },

  // Get user profile
  async getUserProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split("@")[0],
      avatar: user.user_metadata?.avatar_url,
      provider: user.app_metadata?.provider,
    };
  },

  // Check if user is authenticated
  async isAuthenticated() {
    const user = await this.getCurrentUser();
    return !!user;
  },

  // Check if email is authorized
  async isEmailAuthorized(email) {
    try {
      const { data, error } = await supabase.functions.invoke('check-auth');

      if (error) {
        console.error("Error checking authorization:", error);
        return false;
      }

      return data?.authorized || false;
    } catch (err) {
      console.error("Authorization check failed:", err);
      return false;
    }
  },
};
