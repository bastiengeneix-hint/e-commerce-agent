"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";

/**
 * Hook to handle Google account reconnection flow
 */
export function useReconnectGoogle() {
  const router = useRouter();
  const [reconnecting, setReconnecting] = useState(false);
  const utils = api.useUtils();

  const verifyMutation = api.google_analytics.verifyReconnection.useMutation();

  /**
   * Start the reconnection flow
   * Redirects user to Google OAuth
   */
  const startReconnection = useCallback((returnUrl?: string) => {
    // Mark in sessionStorage that we're starting reconnection
    sessionStorage.setItem("oauth-reconnecting", "true");
    setReconnecting(true);
    const params = new URLSearchParams({
      provider: "google",
      callbackUrl: returnUrl ?? window.location.pathname,
    });
    window.location.href = `/api/auth/signin?${params.toString()}`;
  }, []);

  // Check if we just came back from OAuth flow
  useEffect(() => {
    const wasReconnecting = sessionStorage.getItem("oauth-reconnecting");

    if (!wasReconnecting) {
      return;
    }

    // Clear the flag
    sessionStorage.removeItem("oauth-reconnecting");

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error) {
      console.error("OAuth error:", error);
      toast.error("Google connection failed. Please try again.");
      return;
    }

    // We just came back from OAuth - verify reconnection with retry
    const verifyReconnection = async () => {
      setReconnecting(true);

      // Wait briefly for NextAuth to persist account data
      // This helps avoid race conditions where we query before DB write completes
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        // Try up to 3 times with exponential backoff
        const maxAttempts = 3;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            await verifyMutation.mutateAsync();

            // Invalidate queries to refresh data
            await utils.google_analytics.getConnectionStatus.invalidate();
            await utils.google_analytics.getSelectedProperty.invalidate();
            await utils.google_analytics.listAccounts.invalidate();

            // Clean up URL if it has OAuth params
            const url = new URL(window.location.href);
            if (url.searchParams.has("code") || url.searchParams.has("state")) {
              url.searchParams.delete("code");
              url.searchParams.delete("state");
              url.searchParams.delete("scope");
              router.replace(url.pathname + url.search);
            }

            // Success
            toast.success("Google account reconnected successfully.");
            return;
          } catch {
            // Don't retry on the last attempt
            if (attempt < maxAttempts - 1) {
              // Wait before retrying (1s, 2s, 3s)
              await new Promise((resolve) =>
                setTimeout(resolve, (attempt + 1) * 1000),
              );
            }
          }
        }

        // All attempts failed - notify user
        toast.error(
          "Failed to verify Google reconnection. Please try reconnecting again.",
        );
        // Still invalidate queries - the connection might work on next manual attempt
        await utils.google_analytics.getConnectionStatus.invalidate();
      } finally {
        setReconnecting(false);
      }
    };

    void verifyReconnection();
  }, [verifyMutation, utils, router]);

  return {
    startReconnection,
    reconnecting,
    verificationResult: verifyMutation.data,
    verificationError: verifyMutation.error,
  };
}
