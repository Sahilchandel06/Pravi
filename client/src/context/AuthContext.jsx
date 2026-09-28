import { createContext, useContext, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("infralife_user") || "null"),
  );
  const login = async (credentials) => {
    const result = await api.post("/auth/login", credentials);
    localStorage.setItem("infralife_token", result.data.data.token);
    localStorage.setItem(
      "infralife_user",
      JSON.stringify(result.data.data.user),
    );
    setUser(result.data.data.user);
  };
  const logout = () => {
    localStorage.clear();
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
