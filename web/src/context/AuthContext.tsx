import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken, getAccessToken } from "../lib/api";
import type { TokenPair, User } from "../lib/types";

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  country: string;
  base_currency: string;
}

interface ProfileUpdate {
  first_name?: string;
  last_name?: string;
  country?: string;
  base_currency?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await api.get<User>("/users/me"));
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  async function login(email: string, password: string) {
    const tokens = await api.post<TokenPair>(
      "/auth/login",
      { email, password },
      false
    );
    setAccessToken(tokens.access_token);
    setUser(await api.get<User>("/users/me"));
  }

  async function register(data: RegisterData) {
    await api.post<User>("/auth/register", data, false);
    await login(data.email, data.password);
  }

  async function updateProfile(data: ProfileUpdate) {
    setUser(await api.patch<User>("/users/me", data));
  }

  function logout() {
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
