"use client";

import { ThemeProvider } from "./theme-provider";
import { HideBalanceProvider } from "./hide-balance-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <HideBalanceProvider>{children}</HideBalanceProvider>
    </ThemeProvider>
  );
}
