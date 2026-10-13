import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ToastProvider } from "../components/ui";
import { createQueryClient } from "./queryClient";

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [qc] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
