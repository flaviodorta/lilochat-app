'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js'; // Importa o tipo User do Supabase
import supabaseCreateClient from '@/supabase/supabase-client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const supabase = supabaseCreateClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
        setIsAuthenticated(true); // Atualize isAuth aqui se o usuário estiver logado
        console.log(data);
      }
    };

    checkUser();

    // const { data: authListener } = supabase.auth.onAuthStateChange(
    //   (event: AuthChangeEvent, session: Session | null) => {
    //     if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    //       setUser(session?.user || null);
    //       setIsAuthenticated(true);
    //     } else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
    //       setUser(null);
    //       setIsAuthenticated(false);
    //     }
    //   }
    // );

    // return () => {
    //   authListener?.subscription.unsubscribe();
    // };
  }, [supabase]); // Adiciona supabase como dependência

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, setIsAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { useAuth, AuthProvider };
