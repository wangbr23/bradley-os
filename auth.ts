import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Returns a real `string`, not a narrowed `string | undefined` — narrowing
// from an `if (!x) throw` guard doesn't persist into closures (e.g. the
// NextAuth callbacks below), so a validated-but-still-optional const would
// still need a non-null assertion at every use site inside them.
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const ownerEmail = requireEnv("OWNER_EMAIL").toLowerCase();
const googleClientId = requireEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

async function refreshGoogleAccessToken(token: {
  googleRefreshToken?: string;
}) {
  if (!token.googleRefreshToken) {
    throw new Error("Google did not provide a refresh token");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: token.googleRefreshToken,
    }),
  });
  const refreshed = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };

  if (!response.ok || !refreshed.access_token || !refreshed.expires_in) {
    throw new Error("Unable to refresh the Google access token");
  }

  return {
    googleAccessToken: refreshed.access_token,
    googleAccessTokenExpiresAt:
      Math.floor(Date.now() / 1000) + refreshed.expires_in,
    googleRefreshToken:
      refreshed.refresh_token ?? token.googleRefreshToken,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar",
        },
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    signIn({ user }) {
      return user.email?.toLowerCase() === ownerEmail;
    },
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
    async jwt({ token, account }) {
      if (account) {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleAccessTokenExpiresAt = account.expires_at;
        token.googleTokenError = undefined;
        return token;
      }

      const expiresAt = token.googleAccessTokenExpiresAt ?? 0;
      if (Date.now() < (expiresAt - 60) * 1000) {
        return token;
      }

      try {
        return { ...token, ...(await refreshGoogleAccessToken(token)) };
      } catch {
        return { ...token, googleTokenError: "RefreshAccessTokenError" };
      }
    },
    session({ session, token }) {
      session.googleAccessToken = token.googleAccessToken;
      session.googleTokenError = token.googleTokenError;
      return session;
    },
  },
});
