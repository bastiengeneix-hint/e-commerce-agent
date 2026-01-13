import { and, eq } from "drizzle-orm";
import {
  google,
  analyticsadmin_v1beta,
  analyticsdata_v1beta,
} from "googleapis";
import type { Credentials, OAuth2Client } from "google-auth-library";

import { env } from "@/env";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";

const GOOGLE_PROVIDER_ID = "google" as const;
const NEXTAUTH_SIGNIN_PATH = "/api/auth/signin" as const;
const DEFAULT_CALLBACK_URL = "/" as const;
const ERROR_CODE_NEEDS_GOOGLE_OAUTH = "NEEDS_GOOGLE_OAUTH" as const;
const TOKEN_REFRESH_SKEW_MS = 60_000; // 1 minute skew
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export enum GoogleAuthErrorReason {
  NO_ACCOUNT = "NO_ACCOUNT",
  MISSING_SCOPES = "MISSING_SCOPES",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  REFRESH_FAILED = "REFRESH_FAILED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
}

export type NeedsGoogleOAuthError = {
  code: typeof ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  reason: GoogleAuthErrorReason;
  message: string;
  userMessage: string;
  authorizeUrl: string;
  canRetry: boolean;
};

function buildAuthorizeUrl(callbackUrl: string = DEFAULT_CALLBACK_URL) {
  const params = new URLSearchParams({
    provider: GOOGLE_PROVIDER_ID,
    callbackUrl,
  });
  return `${NEXTAUTH_SIGNIN_PATH}?${params.toString()}`;
}

function getErrorMessages(reason: GoogleAuthErrorReason): {
  message: string;
  userMessage: string;
  canRetry: boolean;
} {
  switch (reason) {
    case GoogleAuthErrorReason.NO_ACCOUNT:
      return {
        message: "No Google account connected",
        userMessage:
          "Please connect your Google account to access Google Analytics features.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.MISSING_SCOPES:
      return {
        message: "Missing required Google Analytics scopes",
        userMessage:
          "Additional permissions are required. Please reconnect your Google account.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.TOKEN_EXPIRED:
      return {
        message: "Access token expired and no refresh token available",
        userMessage:
          "Your Google connection has expired. Please reconnect to continue.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.REFRESH_FAILED:
      return {
        message: "Failed to refresh access token",
        userMessage:
          "Unable to refresh your Google connection. Please reconnect your account.",
        canRetry: false,
      };
    case GoogleAuthErrorReason.TOKEN_REVOKED:
      return {
        message: "Refresh token has been revoked",
        userMessage:
          "Your Google connection was revoked. Please reconnect to restore access.",
        canRetry: false,
      };
    default:
      return {
        message: "Google authentication required",
        userMessage: "Please connect your Google account to continue.",
        canRetry: false,
      };
  }
}

export class GoogleOAuthRequired extends Error {
  code: NeedsGoogleOAuthError["code"] = ERROR_CODE_NEEDS_GOOGLE_OAUTH;
  reason: GoogleAuthErrorReason;
  authorizeUrl: string;
  userMessage: string;
  canRetry: boolean;

  constructor(
    reason: GoogleAuthErrorReason,
    technicalMessage?: string,
    authorizeUrl?: string,
  ) {
    const { message, userMessage, canRetry } = getErrorMessages(reason);
    super(technicalMessage ?? message);
    this.name = "GoogleOAuthRequired";
    this.reason = reason;
    this.userMessage = userMessage;
    this.authorizeUrl = authorizeUrl ?? buildAuthorizeUrl();
    this.canRetry = canRetry;
  }

  toJSON(): NeedsGoogleOAuthError {
    return {
      code: this.code,
      reason: this.reason,
      message: this.message,
      userMessage: this.userMessage,
      authorizeUrl: this.authorizeUrl,
      canRetry: this.canRetry,
    };
  }
}

/**
 * Retry token refresh with exponential backoff
 * Only retries on transient errors (5xx, network issues)
 * Does not retry on permanent failures (invalid_grant, etc.)
 */
async function refreshAccessTokenWithRetry(
  oauth2: OAuth2Client,
  maxRetries = 3,
): Promise<Credentials> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      return credentials;
    } catch (err) {
      lastError = err as Error;
      const error = err as {
        response?: { status?: number; data?: { error?: string } };
        code?: string;
        message?: string;
      };
      const errorCode = error?.response?.data?.error;
      const statusCode = error?.response?.status;

      // Don't retry on permanent failures
      if (
        errorCode === "invalid_grant" ||
        errorCode === "invalid_client" ||
        statusCode === 401 ||
        statusCode === 403
      ) {
        throw err;
      }

      // Retry on server errors or network issues
      if (statusCode && statusCode >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Unknown error - don't retry
      throw err;
    }
  }

  throw lastError ?? new Error("Token refresh failed after retries");
}

export async function getGoogleOAuthClientForUser(userId: string) {
  // Lookup the user's Google account row
  const [account] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, GOOGLE_PROVIDER_ID),
      ),
    );

  if (!account) {
    console.error(`[GoogleAuth] No Google account found for user ${userId}`);
    throw new GoogleOAuthRequired(GoogleAuthErrorReason.NO_ACCOUNT);
  }

  console.log(`[GoogleAuth] Found Google account for user ${userId}`, {
    hasAccessToken: !!account.access_token,
    hasRefreshToken: !!account.refresh_token,
    expiresAt: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : 'N/A',
    scopes: account.scope?.split(' ').length ?? 0,
  });

  function hasAllRequiredScopes(scope?: string | null) {
    if (!scope) return false;
    const granted = new Set(scope.split(/\s+/).filter(Boolean));
    return REQUIRED_SCOPES.every((s) => granted.has(s));
  }

  // If required scopes are missing, force re-consent
  if (!hasAllRequiredScopes(account.scope)) {
    console.error(`[GoogleAuth] Missing required scopes for user ${userId}`, {
      grantedScopes: account.scope?.split(' ') ?? [],
      requiredScopes: REQUIRED_SCOPES,
    });
    throw new GoogleOAuthRequired(GoogleAuthErrorReason.MISSING_SCOPES);
  }

  const oauth2 = new google.auth.OAuth2(
    env.AUTH_GOOGLE_ID,
    env.AUTH_GOOGLE_SECRET,
    // redirectUri - not needed for API calls, only for auth flow
  );

  oauth2.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    scope: account.scope ?? undefined,
    token_type: account.token_type ?? undefined,
    id_token: account.id_token ?? undefined,
  });

  // If token is missing or expired/near expiry, refresh using the refresh_token
  const nowMs = Date.now();
  const expiryMs = account.expires_at ? account.expires_at * 1000 : 0;
  const needsRefresh =
    !account.access_token ||
    (expiryMs && expiryMs - nowMs < TOKEN_REFRESH_SKEW_MS);

  // If we need a refresh but have no refresh token, require reconnect
  if (needsRefresh && !account.refresh_token) {
    console.error(`[GoogleAuth] Token expired and no refresh token available for user ${userId}`, {
      accessTokenPresent: !!account.access_token,
      expiryMs,
      nowMs,
      expired: expiryMs < nowMs,
    });
    throw new GoogleOAuthRequired(GoogleAuthErrorReason.TOKEN_EXPIRED);
  }

  if (needsRefresh && account.refresh_token) {
    console.log(`[GoogleAuth] Refreshing expired token for user ${userId}...`);
    try {
      // Use retry logic for transient failures
      const credentials = await refreshAccessTokenWithRetry(oauth2);
      console.log(`[GoogleAuth] Token refresh successful for user ${userId}`, {
        newExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : 'N/A',
        hasNewRefreshToken: !!credentials.refresh_token,
      });

      // Persist updated tokens
      const newAccessToken = credentials.access_token ?? null;
      const newIdToken = credentials.id_token ?? null;
      const newScope = credentials.scope ?? null;
      const newTokenType = credentials.token_type ?? null;
      const newExpiresAt = credentials.expiry_date
        ? Math.floor(credentials.expiry_date / 1000)
        : null;
      // Google MAY return a new refresh token; if so, use it
      const newRefreshToken =
        credentials.refresh_token ?? account.refresh_token;

      await db
        .update(accounts)
        .set({
          access_token: newAccessToken,
          refresh_token: newRefreshToken ?? undefined,
          id_token: newIdToken,
          scope: newScope,
          token_type: newTokenType,
          expires_at: newExpiresAt ?? undefined,
        })
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.provider, GOOGLE_PROVIDER_ID),
          ),
        );

      // Update local credentials so returned client is ready
      oauth2.setCredentials({
        access_token: credentials.access_token,
        refresh_token: newRefreshToken ?? undefined,
        id_token: credentials.id_token,
        scope: credentials.scope,
        token_type: credentials.token_type,
        expiry_date: credentials.expiry_date,
      });

      // Token refresh succeeded
    } catch (err) {
      // Detailed error classification
      const error = err as {
        response?: {
          status?: number;
          data?: { error?: string; error_description?: string };
        };
        message?: string;
      };
      const errorCode = error?.response?.data?.error;
      const errorDescription = error?.response?.data?.error_description;
      const statusCode = error?.response?.status;

      // Classify error type
      if (errorCode === "invalid_grant") {
        // Most common: user revoked access, token expired, or security event
        console.error(`[GoogleAuth] invalid_grant error for user ${userId}`, {
          errorCode,
          errorDescription,
          statusCode,
          message: error?.message,
        });

        // Clear the refresh token since it's no longer valid
        await db
          .update(accounts)
          .set({ refresh_token: null })
          .where(
            and(
              eq(accounts.userId, userId),
              eq(accounts.provider, GOOGLE_PROVIDER_ID),
            ),
          );

        throw new GoogleOAuthRequired(
          GoogleAuthErrorReason.TOKEN_REVOKED,
          errorDescription ?? "Refresh token is no longer valid",
        );
      }

      if (errorCode === "invalid_client") {
        // Client credentials (app keys) are wrong
        console.error(`[GoogleAuth] CRITICAL: Invalid OAuth client credentials for user ${userId}`, {
          errorCode,
          errorDescription,
          clientIdConfigured: !!env.AUTH_GOOGLE_ID,
          clientSecretConfigured: !!env.AUTH_GOOGLE_SECRET,
        });
        throw new GoogleOAuthRequired(
          GoogleAuthErrorReason.REFRESH_FAILED,
          "OAuth client configuration error",
        );
      }

      if (statusCode === 401 || statusCode === 403) {
        // Unauthorized or forbidden
        throw new GoogleOAuthRequired(
          GoogleAuthErrorReason.REFRESH_FAILED,
          errorDescription ?? "Token refresh unauthorized",
        );
      }

      if (statusCode && statusCode >= 500) {
        // Google server error - might be temporary (but retries already exhausted)
        throw new GoogleOAuthRequired(
          GoogleAuthErrorReason.REFRESH_FAILED,
          "Google server error. Please try again later.",
        );
      }

      // Unknown error
      console.error(`[GoogleAuth] Unknown token refresh error for user ${userId}`, {
        errorCode,
        errorDescription,
        statusCode,
        message: error?.message,
      });

      throw new GoogleOAuthRequired(
        GoogleAuthErrorReason.REFRESH_FAILED,
        errorDescription ?? error?.message ?? "Failed to refresh access token",
      );
    }
  }

  console.log(`[GoogleAuth] OAuth client ready for user ${userId}`);
  return oauth2;
}

export async function getAnalyticsDataClient(userId: string) {
  const auth = await getGoogleOAuthClientForUser(userId);

  // Same workaround as Admin client - use explicit Bearer token
  const authCreds = auth.credentials;
  const accessToken = authCreds.access_token;
  if (!accessToken) {
    throw new GoogleOAuthRequired(
      GoogleAuthErrorReason.TOKEN_EXPIRED,
      "No access token available for Analytics Data client",
    );
  }

  return new analyticsdata_v1beta.Analyticsdata({
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getAnalyticsAdminClient(userId: string) {
  const auth = await getGoogleOAuthClientForUser(userId);

  // WORKAROUND: Use explicit Bearer token headers
  // The googleapis library's OAuth2Client sometimes fails to inject credentials properly
  const accessToken = auth.credentials.access_token;
  if (!accessToken) {
    throw new GoogleOAuthRequired(
      GoogleAuthErrorReason.TOKEN_EXPIRED,
      "No access token available for API client",
    );
  }

  return new analyticsadmin_v1beta.Analyticsadmin({
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
