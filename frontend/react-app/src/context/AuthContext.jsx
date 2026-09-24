import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(window.atob(payload));
    return decoded;
  } catch (e) {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser({
          id: decoded.id,
          role: decoded.role,
          email: localStorage.getItem('email'),
          name: localStorage.getItem('name'),
          profilePic: localStorage.getItem('profilePic') || null,
          onboardingCompleted: localStorage.getItem('onboardingCompleted') === 'true'
        });
      }
    }
    setInitialized(true);
  }, []);

  const login = (userObj, token) => {
    if (token) localStorage.setItem('token', token);
    if (userObj && userObj.email) localStorage.setItem('email', userObj.email);
    if (userObj && userObj.name) localStorage.setItem('name', userObj.name);
    if (userObj && userObj.profilePic) localStorage.setItem('profilePic', userObj.profilePic);
    else localStorage.removeItem('profilePic');
    localStorage.setItem('onboardingCompleted', userObj?.onboardingCompleted ? 'true' : 'false');
    setUser(userObj);
  };

  const updateProfilePic = (profilePic) => {
    if (profilePic) localStorage.setItem('profilePic', profilePic);
    else localStorage.removeItem('profilePic');
    setUser(prev => prev ? { ...prev, profilePic } : prev);
  };

  const setOnboardingDone = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setUser(prev => prev ? { ...prev, onboardingCompleted: true } : prev);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    localStorage.removeItem("name");
    localStorage.removeItem("profilePic");
    localStorage.removeItem("onboardingCompleted");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, initialized, updateProfilePic, setOnboardingDone }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
