import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/components/auth";
import { ThemeProvider } from "@/components/theme";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}
