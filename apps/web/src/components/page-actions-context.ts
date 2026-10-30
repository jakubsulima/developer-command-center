import { createContext, type ReactNode } from "react";

export const PageActionsContext = createContext<{ add: ReactNode; search: ReactNode }>({ add: null, search: null });
