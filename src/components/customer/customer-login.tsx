/**
 * Storefront customer login gate — Google sign-in only.
 *
 * Completely independent of the merchant login UI: the Google handshake returns
 * to /auth/callback, which issues the merchant-scoped customer session.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, X } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/google-button";
import {
  ensureGuestCustomerSession,
  getCustomerSession,
} from "@/lib/customer-auth.functions";
import type { CustomerSessionInfo } from "@/lib/customer-auth-types";
import { OPEN_ACCESS } from "@/lib/open-access";

export function useCustomerSession(opts?: {
  merchantId?: string | null;
  visitorId?: string | null;
  enabled?: boolean;
}) {
  const fn = useServerFn(getCustomerSession);
  const ensureGuest = useServerFn(ensureGuestCustomerSession);
  const enabled = opts?.enabled ?? true;
  const query = useQuery<CustomerSessionInfo>({
    queryKey: ["customer-session"],
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });

  const tried = useRef(false);
  const merchantId = opts?.merchantId ?? null;
  useEffect(() => {
    if (!enabled) return;
    if (!OPEN_ACCESS || tried.current) return;
    if (!merchantId || query.isLoading || query.data?.loggedIn) return;
    tried.current = true;
    ensureGuest({
      data: { merchant_id: merchantId, visitor_id: opts?.visitorId ?? null },
    })
      .then(() => query.refetch())
      .catch(() => undefined);
  }, [enabled, merchantId, opts?.visitorId, query.isLoading, query.data?.loggedIn]);

  return query;
}

export function CustomerLoginPanel({
  merchantId,
  visitorId,
  brandName,
  onCancel,
  themePrimary,
}: {
  merchantId: string;
  visitorId?: string | null;
  brandName?: string;
  onSuccess?: (email: string) => void;
  onCancel?: () => void;
  themePrimary?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border bg-background p-5 shadow-elegant" dir="rtl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <LogIn className="h-4 w-4" /> تسجيل الدخول باستخدام Google
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {brandName ? `للمتابعة مع ${brandName}، ` : ""}
            سجّل الدخول بحسابك في Google — بدون كلمة مرور ولا رموز تحقق.
          </p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="rounded p-1 hover:bg-muted" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <GoogleSignInButton
        intent={{
          kind: "customer",
          merchantId,
          visitorId: visitorId ?? null,
          returnTo:
            typeof window === "undefined"
              ? "/"
              : window.location.pathname + window.location.search,
        }}
        onError={setError}
        style={themePrimary ? { borderColor: themePrimary } : undefined}
      />
      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

/**
 * Small inline sign-in gate: shows the signed-in customer's content, or the
 * Google sign-in panel when signed out.
 */
export function CustomerAuthGate({
  merchantId,
  visitorId,
  brandName,
  themePrimary,
  children,
}: {
  merchantId: string;
  visitorId?: string | null;
  brandName?: string;
  themePrimary?: string;
  children?: React.ReactNode;
}) {
  const session = useCustomerSession({ merchantId, visitorId });
  if (session.isLoading) {
    return (
      <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
        جارٍ التحقق من الجلسة…
      </div>
    );
  }
  if (session.data?.loggedIn) {
    return <>{children}</>;
  }
  return (
    <CustomerLoginPanel
      merchantId={merchantId}
      visitorId={visitorId}
      brandName={brandName}
      themePrimary={themePrimary}
    />
  );
}
