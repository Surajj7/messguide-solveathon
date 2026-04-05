import React, { createContext, useContext, useEffect, useState } from "react";
import api, { loadStoredToken, setAuthToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = loadStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setUser(res.data);
        setProfile(res.data.studentProfile || null);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    setAuthToken(data.token);
    try {
      const me = await api.get("/auth/me");
      setUser(me.data);
      setProfile(me.data.studentProfile || null);
      return {
        id: me.data.id,
        email: me.data.email,
        name: me.data.name,
        role: me.data.role,
      };
    } catch (e) {
      setAuthToken(null);
      setUser(null);
      setProfile(null);
      throw e;
    }
  }

  function logout() {
    setAuthToken(null);
    setUser(null);
    setProfile(null);
  }

  async function refreshProfile() {
    const me = await api.get("/auth/me");
    setUser(me.data);
    setProfile(me.data.studentProfile || null);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, logout, setProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
