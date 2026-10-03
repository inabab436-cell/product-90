import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { ALLOWED_EMAIL, directSignIn } from "@/lib/direct-login.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول · كيوباي" },
      { name: "description", content: "سجّل الدخول إلى حسابك في كيوباي." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const signIn = useServerFn(directSignIn);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn();
      window.location.replace(res.nextRoute ?? "/welcome");
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "تعذّر تسجيل الدخول.");
    }
  }

  return (
    <AuthCard
      title="مرحبًا بك في كيوباي"
      subtitle={`الدخول مُقيّد مؤقتًا بحساب واحد: ${ALLOWED_EMAIL}`}
    >
      <div className="space-y-4">
        <Button size="lg" className="w-full" disabled={busy} onClick={handleClick}>
          {busy ? "جارٍ الدخول…" : `الدخول بحساب ${ALLOWED_EMAIL}`}
        </Button>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          تم تعطيل تسجيل الدخول عبر Google مؤقتًا.
        </p>
      </div>
    </AuthCard>
  );
}
