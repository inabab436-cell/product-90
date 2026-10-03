/**
 * TEMPORARY single-account sign-in (Google sign-in disabled).
 *
 * Signs the merchant session in as ALLOWED_EMAIL only. No password, no OAuth.
 * To restore Google sign-in, delete this file and re-enable the Google button.
 */
import { createServerFn } from "@tanstack/react-start";

import type { LoginResult } from "@/lib/auth-types";

export const ALLOWED_EMAIL = "inabab436@gmail.com";

export const directSignIn = createServerFn({ method: "POST" }).handler(
  async (): Promise<LoginResult> => {
    const { getSupabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const admin = getSupabaseAdmin();

    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error("تعذّر الوصول إلى الحساب.");
      const match = data.users.find(
        (u) => (u.email ?? "").trim().toLowerCase() === ALLOWED_EMAIL,
      );
      if (match) userId = match.id;
      if (!data.users.length || data.users.length < 200) break;
    }

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: ALLOWED_EMAIL,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error("تعذّر تجهيز الحساب.");
      userId = data.user.id;
    }

    const { updateSession } = await import("@tanstack/react-start/server");
    const { getSessionConfig } = await import("@/lib/session.server");
    await updateSession(getSessionConfig(), { userId, email: ALLOWED_EMAIL });

    const { ensureProfile, getSetupCompleted } = await import(
      "@/lib/profile.server"
    );
    await ensureProfile(userId);
    const setupCompleted = await getSetupCompleted(userId);

    return {
      ok: true,
      message: "تم تسجيل الدخول.",
      email: ALLOWED_EMAIL,
      setupCompleted,
      nextRoute: setupCompleted ? "/dashboard" : "/welcome",
    };
  },
);
