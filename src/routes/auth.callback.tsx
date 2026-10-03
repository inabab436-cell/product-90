/**
 * Google OAuth landing page.
 *
 * Exchanges the OAuth code for a Supabase session in the browser, hands the
 * access token to the matching server function (merchant or storefront
 * customer), then continues to the intended destination.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AuthCard } from "@/components/auth/auth-card";
import {
  clearGoogleIntent,
  getBrowserSupabase,
  readGoogleIntent,
} from "@/lib/supabase-browser";
import { googleSignInCustomer, googleSignInMerchant } from "@/lib/google-auth.functions";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "جارٍ تسجيل الدخول · كيوباي" },
      { name: "description", content: "إكمال تسجيل الدخول باستخدام Google." },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") ?? params.get("error");
      if (oauthError) throw new Error(oauthError);

      const supabase = await getBrowserSupabase();
      const code = params.get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw new Error(exErr.message);
      }
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("لم يتم استلام جلسة من Google.");

      const intent = readGoogleIntent() ?? { kind: "merchant" as const };

      if (intent.kind === "customer") {
        const res = await googleSignInCustomer({
          data: {
            accessToken,
            merchant_id: intent.merchantId,
            visitor_id: intent.visitorId ?? null,
          },
        });
        if (!res.ok) throw new Error(res.message);
        clearGoogleIntent();
        await supabase.auth.signOut();
        window.location.replace(intent.returnTo || "/");
        return;
      }

      const res = await googleSignInMerchant({ data: { accessToken } });
      clearGoogleIntent();
      await supabase.auth.signOut();
      window.location.replace(res.nextRoute ?? "/welcome");
    })().catch((err: unknown) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : "تعذّر إكمال تسجيل الدخول.");
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthCard
      title={error ? "تعذّر تسجيل الدخول" : "جارٍ تسجيل الدخول…"}
      subtitle={error ?? "لحظة واحدة، نكمل تسجيل الدخول باستخدام Google."}
    >
      {error ? (
        <a href="/login" className="text-sm font-medium text-primary hover:underline">
          العودة إلى صفحة تسجيل الدخول
        </a>
      ) : (
        <div className="h-2 w-full animate-pulse rounded bg-muted" />
      )}
    </AuthCard>
  );
}
