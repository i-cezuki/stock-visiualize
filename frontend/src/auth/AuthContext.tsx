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
    getCurrentIdToken()
      .then((token) => {
        setIsAuthenticated(token !== null);
      })
      .catch(() => {
        // getCurrentIdToken is documented to never reject, but defend
        // against it anyway: an uncaught rejection here would leave
        // isLoading stuck true forever, showing a permanent blank page
        // instead of the login screen.
        setIsAuthenticated(false);
      })
      .finally(() => {
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
