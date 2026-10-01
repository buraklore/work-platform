"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api/client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
          },
          mutations: { retry: 0 },
        },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <Toaster
          position="bottom-center"
          offset={{ bottom: 24 }}
          mobileOffset={{ bottom: 88 }}
          toastOptions={{
            classNames: {
              toast: "!bg-fg !text-bg !border-0 !rounded-lg !shadow-pop !font-sans !text-sm",
              actionButton: "!bg-transparent !text-bg !font-semibold !underline !underline-offset-2",
              // Errors must not look like confirmations.
              error: "!bg-danger !text-white",
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
