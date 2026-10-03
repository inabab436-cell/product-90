import { useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/cupai-logo.png.asset.json";
import { acceptStaffInvite, getStaffInvite } from "@/lib/staff.functions";
import { PERMISSION_LABELS } from "@/lib/staff-types";

export const Route = createFileRoute("/team/join")({
  head: () => ({
    meta: [
      { title: "انضمام لفريق العمل · cupai" },
      {
        name: "description",
        content: "أكمل تسجيلك للانضمام إلى فريق العمل داخل لوحة التحكم.",
      },
      { property: "og:title", content: "انضمام لفريق العمل · cupai" },
      {
        property: "og:description",
        content: "سجّل بياناتك بنفسك للدخول إلى الأقسام المسموح لك بها.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search["t"] === "string" ? (search["t"] as string) : "",
  }),
  component: JoinTeamPage,
});

function JoinTeamPage() {
  const { t: token } = useSearch({ from: "/team/join" });

  const invite = useQuery({
    queryKey: ["staff-invite", token],
    enabled: token.length > 0,
    retry: false,
    queryFn: () => getStaffInvite({ data: { token } }),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (invite.data) {
      setName((prev) => prev || invite.data.name);
      setEmail((prev) => prev || invite.data.email || "");
    }
  }, [invite.data]);

  const join = useMutation({
    mutationFn: () => acceptStaffInvite({ data: { token, email, name } }),
    onSuccess: (res) => {
      toast.success("تم تسجيلك بنجاح.");
      window.location.replace(res.nextRoute);
    },
    onError: (e) => toast.error((e as Error)?.message || "تعذّر إكمال التسجيل."),
  });

  const alreadyJoined = invite.data?.status === "active";
  const perms = invite.data?.full_access
    ? ["وصول كامل"]
    : (invite.data?.permissions ?? []).map((p) => PERMISSION_LABELS[p].title);

  return (
    <div dir="rtl" className="hub flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/60 bg-background/80 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <img src={logo.url} alt="cupai" className="h-9 w-9 rounded-lg shadow-card" />
          <span className="text-sm font-semibold tracking-tight">cupai</span>
        </div>

        {!token ? (
          <p className="text-sm text-muted-foreground">
            الرابط غير مكتمل. اطلب رابط الانضمام من صاحب الحساب مرة أخرى.
          </p>
        ) : invite.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحقق من الرابط…
          </div>
        ) : invite.isError ? (
          <p className="text-sm font-medium text-destructive">
            {(invite.error as Error)?.message || "هذا الرابط غير صالح."}
          </p>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {alreadyJoined ? "مرحبًا بك مرة أخرى" : "أكمل تسجيلك"}
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {alreadyJoined
                  ? "أدخل بريدك لتأكيد الدخول إلى لوحة التحكم."
                  : "سجّل بياناتك بنفسك للدخول إلى الأقسام المسموح لك بها."}
              </p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" />
                صلاحياتك
              </div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {perms.length ? perms.join(" · ") : "بدون صلاحيات"}
              </div>
            </div>

            <div className="space-y-3">
              <Input
                placeholder="اسمك"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                dir="ltr"
                type="email"
                placeholder="بريدك الإلكتروني"
                value={email}
                readOnly={alreadyJoined && !!invite.data?.email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={join.isPending}
              onClick={() => join.mutate()}
            >
              {join.isPending ? (
                <Loader2 className="ml-1 h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="ml-1 h-4 w-4" />
              )}
              {alreadyJoined ? "الدخول" : "تسجيل ودخول"}
            </Button>

            <p className="text-xs leading-relaxed text-muted-foreground">
              احفظ هذا الرابط — تستخدمه في أي وقت للدخول بحسابك.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
