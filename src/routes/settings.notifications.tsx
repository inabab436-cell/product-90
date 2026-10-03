import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ArrowLeft, Loader2, MailCheck, BellRing, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import logo from "@/assets/cupai-logo.png.asset.json";
import {
  getEmailNotificationSettings,
  updateEmailNotificationSettings,
  type EmailNotificationSettings,
} from "@/lib/email-notifications.functions";
import {
  getPushSettings,
  updatePushSettings,
  registerPushToken,
  unregisterPushTokens,
  type PushSettings,
} from "@/lib/push.functions";
import { enablePush } from "@/lib/push-client";

export const Route = createFileRoute("/settings/notifications")({
  head: () => ({
    meta: [
      { title: "إعدادات الإشعارات · cupai" },
      {
        name: "description",
        content: "تحكم في إشعارات البريد الإلكتروني التي تصل إلى حسابك.",
      },
    ],
  }),
  component: NotificationSettingsPage,
});

const OPTIONS: Array<{ key: keyof EmailNotificationSettings; title: string; desc: string }> = [
  {
    key: "new_order",
    title: "إشعار عند وصول أوردر جديد",
    desc: "سيتم إعلامك عبر البريد الإلكتروني كلما تم تسجيل طلب جديد في متجرك.",
  },
  {
    key: "missing_information",
    title: "إشعار عند وجود معلومة ناقصة مطلوبة",
    desc: "سيتم إعلامك عندما يسأل أحد العملاء عن معلومة غير متوفرة لدى الوكيل الذكي.",
  },
];

function NotificationSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["email-notification-settings"],
    queryFn: () => getEmailNotificationSettings(),
  });

  const [state, setState] = useState<EmailNotificationSettings>({
    new_order: true,
    missing_information: true,
  });

  useEffect(() => {
    if (q.data) {
      setState({
        new_order: q.data.new_order,
        missing_information: q.data.missing_information,
      });
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: (next: EmailNotificationSettings) =>
      updateEmailNotificationSettings({ data: next }),
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات.");
      qc.invalidateQueries({ queryKey: ["email-notification-settings"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذر حفظ الإعدادات."),
  });

  function toggle(key: keyof EmailNotificationSettings, value: boolean) {
    const next = { ...state, [key]: value };
    setState(next);
    m.mutate(next);
  }

  function toggleAll(value: boolean) {
    const next: EmailNotificationSettings = {
      new_order: value,
      missing_information: value,
    };
    setState(next);
    m.mutate(next);
  }

  const allOn = state.new_order && state.missing_information;

  return (
    <div dir="rtl" className="hub min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo.url} alt="cupai" className="h-8 w-8 rounded-lg shadow-card" />
            <span className="text-sm font-semibold tracking-tight">cupai</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="ml-1 h-4 w-4" />
              لوحة التحكم
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <section>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-gradient-brand p-2.5 text-primary-foreground shadow-glow">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">إعدادات الإشعارات</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                فعّل أو عطّل كل نوع إشعار بشكل مستقل.
              </p>
            </div>
          </div>
        </section>

        <PushSection />

        <section className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
          <MailCheck className="h-4 w-4 shrink-0" />
          <p>
            ستصل الرسائل إلى البريد الإلكتروني المسجل
            {q.data?.email ? (
              <>
                {" "}
                (<span className="font-semibold">{q.data.email}</span>)
              </>
            ) : null}
            .
          </p>
        </section>

        <section className="rounded-2xl border border-border/60 bg-background/80 shadow-card backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/60 p-4">
            <div>
              <div className="text-sm font-semibold">تفعيل الكل</div>
              <div className="text-xs text-muted-foreground">
                تشغيل أو إيقاف كل الإشعارات دفعة واحدة.
              </div>
            </div>
            <Switch
              checked={allOn}
              disabled={q.isLoading || m.isPending}
              onCheckedChange={(v) => toggleAll(!!v)}
            />
          </div>

          <ul className="divide-y divide-border/60">
            {OPTIONS.map((opt) => (
              <li key={opt.key} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{opt.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {opt.desc}
                  </div>
                </div>
                <Switch
                  checked={state[opt.key]}
                  disabled={q.isLoading || m.isPending}
                  onCheckedChange={(v) => toggle(opt.key, !!v)}
                />
              </li>
            ))}
          </ul>

          {(q.isLoading || m.isPending) && (
            <div className="flex items-center gap-2 border-t border-border/60 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {q.isLoading ? "جاري التحميل…" : "جاري الحفظ…"}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const PUSH_OPTIONS: Array<{ key: keyof PushSettings; title: string }> = [
  { key: "new_order", title: "أوردر جديد" },
  { key: "missing_information", title: "معلومة ناقصة" },
  { key: "human_needed", title: "تدخل بشري مطلوب" },
];

function PushSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["push-settings"], queryFn: () => getPushSettings() });
  const [state, setState] = useState<PushSettings>({
    new_order: true,
    missing_information: true,
    human_needed: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data) {
      setState({
        new_order: q.data.new_order,
        missing_information: q.data.missing_information,
        human_needed: q.data.human_needed,
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (next: PushSettings) => updatePushSettings({ data: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push-settings"] }),
    onError: (e: any) => toast.error(e?.message || "تعذر حفظ الإعدادات."),
  });

  function toggle(key: keyof PushSettings, value: boolean) {
    const next = { ...state, [key]: value };
    setState(next);
    save.mutate(next);
  }

  async function activate() {
    setBusy(true);
    try {
      const res = await enablePush();
      if (res.status === "registered") {
        await registerPushToken({
          data: { token: res.token, user_agent: navigator.userAgent.slice(0, 380) },
        });
        toast.success("تم تفعيل إشعارات هذا الجهاز.");
        qc.invalidateQueries({ queryKey: ["push-settings"] });
      } else if (res.status === "open-in-new-tab") {
        toast.error("افتح الموقع في تاب منفصل (وليس داخل المعاينة) ثم أعد المحاولة.");
      } else if (res.status === "denied") {
        toast.error("تم رفض الإذن. اسمح بالإشعارات من إعدادات المتصفح للموقع.");
      } else if (res.status === "unsupported") {
        toast.error("هذا المتصفح لا يدعم إشعارات الدفع.");
      } else {
        toast.error("خدمة الإشعارات غير مكتملة الإعداد بعد.");
      }
    } catch (e: any) {
      toast.error(e?.message || "تعذر تفعيل الإشعارات.");
    } finally {
      setBusy(false);
    }
  }

  async function disableAll() {
    setBusy(true);
    try {
      await unregisterPushTokens();
      toast.success("تم إيقاف إشعارات كل الأجهزة.");
      qc.invalidateQueries({ queryKey: ["push-settings"] });
    } catch (e: any) {
      toast.error(e?.message || "تعذر الإيقاف.");
    } finally {
      setBusy(false);
    }
  }

  const devices = q.data?.device_count ?? 0;

  return (
    <section className="rounded-2xl border border-border/60 bg-background/80 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-brand p-2.5 text-primary-foreground shadow-glow">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">إشعارات المتصفح والجهاز</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
              تصلك التنبيهات فورًا حتى لو الموقع أو المتصفح مغلق. فعّلها على كل جهاز تستخدمه.
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              {devices > 0 ? `${devices} جهاز مُفعّل` : "لا يوجد جهاز مُفعّل بعد"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={activate} disabled={busy}>
            {busy ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
            تفعيل على هذا الجهاز
          </Button>
          {devices > 0 && (
            <Button size="sm" variant="ghost" onClick={disableAll} disabled={busy}>
              إيقاف الكل
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {PUSH_OPTIONS.map((opt) => (
          <li key={opt.key} className="flex items-center justify-between gap-4 p-4">
            <div className="text-sm font-semibold">{opt.title}</div>
            <Switch
              checked={state[opt.key]}
              disabled={q.isLoading || save.isPending}
              onCheckedChange={(v) => toggle(opt.key, !!v)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
