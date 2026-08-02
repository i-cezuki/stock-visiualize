import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { login as cognitoLogin, logout as cognitoLogout, getCurrentIdToken } from "./cognitoAuth";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentIdToken().then((token) => {
      setIsAuthenticated(token !== null);
      setIsLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    await cognitoLogin(email, password);
    setIsAuthenticated(true);
  }

  function logout() {
    cognitoLogout();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
