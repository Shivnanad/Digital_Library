import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { API_BASE } from "../config/api";

const AuthContext = createContext();

/* ── JWT helpers ── */
const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(window.atob(payload));
  } catch {
    return null;
  }
};

/** Returns true if the token has expired or will expire within `bufferMs` */
const isTokenExpired = (token, bufferMs = 60_000) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp * 1000 < Date.now() + bufferMs;
};

/* ── Storage helpers (localStorage for Remember Me, sessionStorage otherwise) ── */
const REMEMBER_KEY = "readify_remember";

function getRememberMe() {
  try { return localStorage.getItem(REMEMBER_KEY) === "true"; } catch { return false; }
}

function getStorage() {
  return getRememberMe() ? localStorage : sessionStorage;
}

function getToken() {
  // Check both storages — token might have been set before remember-me toggle
  return localStorage.getItem("token") || sessionStorage.getItem("token") || null;
}

function setTokenInStorage(token, rememberMe) {
  try {
    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, "true");
      localStorage.setItem("token", token);
      sessionStorage.removeItem("token");
    } else {
      localStorage.setItem(REMEMBER_KEY, "false");
      sessionStorage.setItem("token", token);
      localStorage.removeItem("token");
    }
  } catch (e) {
    console.error("Failed to store token:", e);
  }
}

function clearTokenFromStorage() {
  try {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
  } catch {}
}

function getStoredUserData() {
  const storage = getStorage();
  return {
    email: storage.getItem("email") || localStorage.getItem("email"),
    name: storage.getItem("name") || localStorage.getItem("name"),
    profilePic: storage.getItem("profilePic") || localStorage.getItem("profilePic") || null,
    onboardingCompleted: (storage.getItem("onboardingCompleted") || localStorage.getItem("onboardingCompleted")) === "true",
  };
}

function setStoredUserData(userObj, rememberMe) {
  const storage = rememberMe ? localStorage : sessionStorage;
  if (userObj?.email) storage.setItem("email", userObj.email);
  if (userObj?.name) storage.setItem("name", userObj.name);
  if (userObj?.profilePic) storage.setItem("profilePic", userObj.profilePic);
  else storage.removeItem("profilePic");
  storage.setItem("onboardingCompleted", userObj?.onboardingCompleted ? "true" : "false");
}

function clearStoredUserData() {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem("email");
    storage.removeItem("name");
    storage.removeItem("profilePic");
    storage.removeItem("onboardingCompleted");
  }
}

/* ── Silent token refresh ── */
async function silentRefresh(currentToken) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

/* ── Validate token with server ── */
async function validateToken(token) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(`${API_BASE}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ── AuthProvider Component ── */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const refreshingRef = useRef(false);
  const lastValidateRef = useRef(0);

  /* ── Initialize from stored token ── */
  useEffect(() => {
    const token = getToken();
    if (token) {
      const decoded = decodeToken(token);
      if (decoded && !isTokenExpired(token, 0)) {
        const stored = getStoredUserData();
        setUser({
          id: decoded.id,
          role: decoded.role,
          email: stored.email,
          name: stored.name,
          profilePic: stored.profilePic,
          onboardingCompleted: stored.onboardingCompleted,
        });
      } else {
        // Token is expired — clear it
        clearTokenFromStorage();
        clearStoredUserData();
      }
    }
    setInitialized(true);
  }, []);

  /* ── Attempt silent refresh when token is expiring soon ── */
  const attemptRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      const token = getToken();
      if (!token) return;

      // Only refresh if token expires within 30 minutes
      if (!isTokenExpired(token, 30 * 60 * 1000)) return;

      // If completely expired (beyond 7 day window), don't try to refresh
      if (isTokenExpired(token, -24 * 60 * 60 * 1000)) {
        // Token too old, force logout
        clearTokenFromStorage();
        clearStoredUserData();
        setUser(null);
        return;
      }

      const newToken = await silentRefresh(token);
      if (newToken) {
        const rememberMe = getRememberMe();
        setTokenInStorage(newToken, rememberMe);
      }
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  /* ── Visibility change handler (background → foreground) ── */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      const token = getToken();
      if (!token) return;

      // Debounce — don't validate more than once per 30 seconds
      const now = Date.now();
      if (now - lastValidateRef.current < 30_000) return;
      lastValidateRef.current = now;

      if (isTokenExpired(token, 0)) {
        // Token expired while in background — try refresh
        const newToken = await silentRefresh(token);
        if (newToken) {
          const rememberMe = getRememberMe();
          setTokenInStorage(newToken, rememberMe);
          const decoded = decodeToken(newToken);
          if (decoded) {
            const stored = getStoredUserData();
            setUser(prev => prev ? {
              ...prev,
              id: decoded.id,
              role: decoded.role,
            } : {
              id: decoded.id,
              role: decoded.role,
              ...stored,
            });
          }
        } else {
          // Cannot refresh — clear auth
          clearTokenFromStorage();
          clearStoredUserData();
          setUser(null);
        }
      } else if (isTokenExpired(token, 30 * 60 * 1000)) {
        // Token expiring soon — silently refresh
        attemptRefresh();
      }
    };

    const handleOnline = () => {
      // When coming back online, re-validate
      handleVisibilityChange();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [attemptRefresh]);

  /* ── Periodic token freshness check (every 5 minutes) ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const token = getToken();
      if (token && isTokenExpired(token, 30 * 60 * 1000)) {
        attemptRefresh();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [attemptRefresh]);

  /* ── Public API ── */
  const login = useCallback((userObj, token, rememberMe = true) => {
    if (token) setTokenInStorage(token, rememberMe);
    if (userObj) setStoredUserData(userObj, rememberMe);

    // Also keep data in localStorage for backward compatibility
    if (rememberMe && userObj) {
      try {
        if (userObj.email) localStorage.setItem("email", userObj.email);
        if (userObj.name) localStorage.setItem("name", userObj.name);
        if (userObj.profilePic) localStorage.setItem("profilePic", userObj.profilePic);
        else localStorage.removeItem("profilePic");
        localStorage.setItem("onboardingCompleted", userObj?.onboardingCompleted ? "true" : "false");
      } catch {}
    }

    setUser(userObj);
  }, []);

  const updateProfilePic = useCallback((profilePic) => {
    const storage = getStorage();
    if (profilePic) {
      storage.setItem("profilePic", profilePic);
      localStorage.setItem("profilePic", profilePic);
    } else {
      storage.removeItem("profilePic");
      localStorage.removeItem("profilePic");
    }
    setUser(prev => prev ? { ...prev, profilePic } : prev);
  }, []);

  const setOnboardingDone = useCallback(() => {
    const storage = getStorage();
    storage.setItem("onboardingCompleted", "true");
    localStorage.setItem("onboardingCompleted", "true");
    setUser(prev => prev ? { ...prev, onboardingCompleted: true } : prev);
  }, []);

  const logout = useCallback(() => {
    clearTokenFromStorage();
    clearStoredUserData();
    localStorage.removeItem(REMEMBER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, initialized, updateProfilePic, setOnboardingDone }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
