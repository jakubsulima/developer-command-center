import { createContext } from "react";

export type AuthMode = "demo" | "supabase";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  error?: string;
  confirmationRequired?: boolean;
}

export interface AuthContextValue {
  mode: AuthMode;
  user: CurrentUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: { email: string; password: string; name: string; workspaceName: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  continueInDemo: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const demoUser: CurrentUser = {
  id: "demo-user",
  email: "jakub@example.com",
  name: "Jakub Kowalski"
};
