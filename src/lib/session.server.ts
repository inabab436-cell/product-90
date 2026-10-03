/**
 * Server-only session configuration for cupai.
 *
 * Uses TanStack Start's encrypted cookie sessions. The encryption password is
 * read from the CUPAI_APP_SESSION_SECRET environment variable at call time and
 * is never hardcoded. MUST NOT be imported from client/browser code.
 */

export interface AppSessionData {
  /**
   * ALWAYS the brand owner's (merchant) user id — for staff sessions too, so
   * every merchant-scoped query keeps working unchanged.
   */
  userId: string;
  email: string;
  /** Present only when a staff member is signed in (not the owner). */
  staffId?: string;
  /** The signed-in person's own email (staff email, or the owner's). */
  actorEmail?: string;
}

export function getSessionConfig() {
  const password = process.env.CUPAI_APP_SESSION_SECRET;
  if (!password) {
    throw new Error("Missing required environment variable: CUPAI_APP_SESSION_SECRET");
  }
  return {
    password,
    name: "cupai_session",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  } as const;
}
