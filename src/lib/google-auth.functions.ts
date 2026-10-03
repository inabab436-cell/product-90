/**
 * Google sign-in completion endpoints.
 *
 * The browser performs the Google OAuth handshake with Supabase Auth and sends
 * the resulting access token here. The token is validated server-side, then the
 * app's own session is established:
 *  - merchants  → encrypted `cupai_session` cookie + profile bootstrap
 *  - customers  → merchant-scoped `cupai_cs` customer session
 */
import { createServerFn } from "@tanstack/react-start";

import type { LoginResult } from "@/lib/auth-types";
import type { CustomerOtpVerifyResult } from "@/lib/customer-auth-types";

function ensureToken(value: unknown): string {
  const s = String(value ?? "").trim();
  if (s.length < 20) throw new Error("رمز الدخول غير صالح.");
  return s;
}

function ensureUuid(value: unknown, label: string): string {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f-]{16,}$/i.test(s)) throw new Error(`${label} غير صالح.`);
  return s;
}

/** Validate a Supabase access token and return the verified Google identity. */
async function verifyGoogleToken(
  accessToken: string,
): Promise<{ id: string; email: string }> {
  const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  const user = data?.user;
  if (error || !user?.email) {
    throw new Error("تعذّر التحقق من حساب Google.");
  }
  return { id: user.id, email: user.email.trim().toLowerCase() };
}

export const googleSignInMerchant = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => ({
    accessToken: ensureToken(data?.accessToken),
  }))
  .handler(async ({ data }): Promise<LoginResult> => {
    const user = await verifyGoogleToken(data.accessToken);

    const { updateSession } = await import("@tanstack/react-start/server");
    const { getSessionConfig } = await import("@/lib/session.server");

    // Staff sign-in: the email belongs to a team member, so the session runs
    // on the OWNER's merchant id with the staff id attached for permissions.
    const { findStaffByEmail, touchStaffLogin } = await import("@/lib/staff.server");
    const staff = await findStaffByEmail(user.email);
    if (staff) {
      if (staff.member.status !== "active") {
        throw new Error("تم إيقاف هذا الحساب. تواصل مع صاحب الحساب.");
      }
      await updateSession(getSessionConfig(), {
        userId: staff.merchantId,
        email: user.email,
        staffId: staff.member.id,
        actorEmail: user.email,
      });
      await touchStaffLogin(staff.member.id);
      return {
        ok: true,
        message: "تم تسجيل الدخول.",
        email: user.email,
        setupCompleted: true,
        nextRoute: "/dashboard",
      };
    }

    await updateSession(getSessionConfig(), { userId: user.id, email: user.email });

    const { ensureProfile, getSetupCompleted } = await import("@/lib/profile.server");
    await ensureProfile(user.id);
    const setupCompleted = await getSetupCompleted(user.id);

    return {
      ok: true,
      message: "تم تسجيل الدخول.",
      email: user.email,
      setupCompleted,
      nextRoute: setupCompleted ? "/dashboard" : "/welcome",
    };
  });

export const googleSignInCustomer = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { accessToken: string; merchant_id: string; visitor_id?: string | null }) => ({
      accessToken: ensureToken(data?.accessToken),
      merchant_id: ensureUuid(data?.merchant_id, "merchant_id"),
      visitor_id: data?.visitor_id ? String(data.visitor_id) : null,
    }),
  )
  .handler(async ({ data }): Promise<CustomerOtpVerifyResult> => {
    const user = await verifyGoogleToken(data.accessToken);
    const { loginCustomerWithVerifiedEmail } = await import("@/lib/customer-auth.server");
    return loginCustomerWithVerifiedEmail(data.merchant_id, user.email, data.visitor_id);
  });
