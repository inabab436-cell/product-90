import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Clock3,
  PackageCheck,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getWaitlistStats, joinWaitlist, WAITLIST_LIMIT } from "@/lib/waitlist.functions";
import logoAsset from "@/assets/cupai-logo.png.asset.json";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "احجز مكانك بين أول 100 مشترك | CUPAI" },
      {
        name: "description",
        content:
          "احجز مكانك بين أول 100 مشترك في CUPAI واحصل على خصم التأسيس. الحجز بالبريد الإلكتروني فقط.",
      },
      { property: "og:title", content: "احجز مكانك بين أول 100 مشترك | CUPAI" },
      {
        property: "og:description",
        content: "وكيل مبيعات ذكي يردّ على عملائك ويكمل طلباتهم على مدار الساعة. خصم خاص لأول 100 مشترك.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

/** Smoothly counts up to the real number coming from the database. */
function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);
  return value;
}

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "يبيع من داخل المحادثة",
    body: "يفهم احتياج العميل، يرشّح المنتج المناسب، ويكمل الطلب حتى التأكيد.",
  },
  {
    icon: PackageCheck,
    title: "متصل بمنتجاتك ومخزونك",
    body: "يعرف المقاسات والألوان المتاحة ويحدّث الكميات مع الطلبات المؤكدة.",
  },
  {
    icon: Sparkles,
    title: "يتعلم تفاصيل عملك",
    body: "ينبّهك للمعلومات الناقصة ويحفظها ليقدّم إجابات أدق في المرات القادمة.",
  },
];

const LAUNCH_AT = Date.UTC(2026, 8, 19, 6, 21, 0);

function useLaunchCountdown() {
  const [remaining, setRemaining] = useState(() => Math.max(0, LAUNCH_AT - Date.now()));

  useEffect(() => {
    const update = () => setRemaining(Math.max(0, LAUNCH_AT - Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

const COUNTDOWN_LABELS = [
  ["days", "يوم"],
  ["hours", "ساعة"],
  ["minutes", "دقيقة"],
  ["seconds", "ثانية"],
] as const;

function JoinPage() {
  const fetchStats = useServerFn(getWaitlistStats);
  const join = useServerFn(joinWaitlist);

  const [count, setCount] = useState(0);
  const [step, setStep] = useState<"intro" | "email" | "done">("intro");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const countdown = useLaunchCountdown();

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((s) => {
        if (active) setCount(s.count);
      })
      .catch(() => {
        /* العدّاد يبقى صفرًا إذا تعذّر الاتصال */
      });
    return () => {
      active = false;
    };
  }, [fetchStats]);

  useEffect(() => {
    if (step === "email") inputRef.current?.focus();
  }, [step]);

  const shown = useCountUp(count);
  const remaining = Math.max(0, WAITLIST_LIMIT - count);
  const percent = Math.min(100, Math.round((count / WAITLIST_LIMIT) * 100));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await join({ data: { email } });
      setCount(res.count);
      setPosition(res.position);
      setStep("done");
      toast.success(res.already ? "أنت محجوز بالفعل ✨" : "تم حجز مكانك 🎉");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الحجز، حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div dir="rtl" className="join-page relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="join-wash pointer-events-none absolute inset-x-0 top-0 h-[38rem]" aria-hidden />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <div className="flex items-center gap-3" dir="ltr">
          <img src={logoAsset.url} alt="CUPAI" className="h-12 w-12 rounded-xl bg-card object-contain p-1 shadow-card" />
          <span className="join-latin text-xl font-bold text-foreground">CUPAI</span>
        </div>
        <span className="join-status inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-card">
          <span className="join-pulse h-2 w-2 rounded-full bg-brand-teal" />
          التسجيل مفتوح الآن
        </span>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-16 pt-7 sm:px-8 sm:pt-12">
        <section className="grid items-center gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <div className="join-reveal max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-2 text-xs font-bold text-accent-foreground">
              <Clock3 className="size-3.5" />
              الإطلاق خلال 3 أيام
            </div>
            <h1 className="text-balance text-[2.55rem] font-black leading-[1.22] sm:text-6xl lg:text-[4.25rem]">
              كن من أوائل من يبيعون
              <span className="mt-1 block text-gradient-brand">بمساعدة وكيل ذكي</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-muted-foreground sm:text-lg">
              نطلق CUPAI قريبًا. احجز مكانك الآن بين أول 100 مشترك لتحصل على أولوية الوصول وخصم المؤسسين.
            </p>

            <div className="mt-8" aria-label="الوقت المتبقي حتى الإطلاق" dir="ltr">
              <p className="mb-3 text-right text-xs font-bold text-muted-foreground" dir="rtl">الوقت المتبقي على الإطلاق</p>
              <div className="grid max-w-lg grid-cols-4 gap-2 sm:gap-3">
                {COUNTDOWN_LABELS.map(([key, label]) => (
                  <div key={key} className="join-time-unit rounded-xl border border-border bg-card px-2 py-3 text-center shadow-card sm:py-4">
                    <strong className="join-latin block text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                      {String(countdown[key]).padStart(2, "0")}
                    </strong>
                    <span className="mt-1 block text-[10px] font-semibold text-muted-foreground sm:text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CircleCheck className="size-4 text-brand-teal" /> بدون دفع الآن</span>
              <span className="flex items-center gap-2"><CircleCheck className="size-4 text-brand-teal" /> لا تأكيد للبريد</span>
              <span className="flex items-center gap-2"><CircleCheck className="size-4 text-brand-teal" /> خصم خاص</span>
            </div>
          </div>

          <aside className="join-reveal join-delay rounded-2xl border border-border bg-card p-5 shadow-elegant sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-bold text-primary">أول 100 مشترك</p>
              <h2 className="mt-2 text-2xl font-black">احجز مكانك قبل الإطلاق</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">خطوة واحدة فقط: أضف بريدك وسنحفظ ترتيبك فورًا.</p>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">تم حجز</p>
                <div className="join-latin mt-2 flex items-baseline gap-2" dir="ltr">
                  <strong className="text-5xl font-bold leading-none text-primary tabular-nums">{shown}</strong>
                  <span className="text-base text-muted-foreground">/ {WAITLIST_LIMIT}</span>
                </div>
              </div>
              <span className="rounded-xl bg-secondary px-4 py-3 text-center">
                <strong className="join-latin block text-xl leading-none tabular-nums">{remaining}</strong>
                <span className="mt-1 block text-[10px] text-muted-foreground">متبقي</span>
              </span>
            </div>

            <div className="mt-7 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="join-progress h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${Math.max(percent, count > 0 ? 4 : 0)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">عداد حقيقي يتحدّث مع كل حجز جديد.</p>

            <div className="mt-7 border-t border-border pt-6">
          {step === "intro" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Button
                size="lg"
                className="h-12 w-full rounded-lg bg-gradient-brand text-base font-bold text-primary-foreground shadow-glow hover:opacity-90"
                onClick={() => setStep("email")}
              >
                ألحق مكانك قبل الإطلاق
                <ArrowLeft />
              </Button>
            </div>
          )}

          {step === "email" && (
            <form
              onSubmit={handleSubmit}
              className="animate-in fade-in slide-in-from-bottom-2 space-y-3 duration-500"
            >
              <label htmlFor="waitlist-email" className="block text-sm font-semibold">
                بريدك الإلكتروني
              </label>
              <Input
                id="waitlist-email"
                ref={inputRef}
                type="email"
                required
                dir="ltr"
                maxLength={255}
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-lg bg-background px-4 text-left text-base shadow-none"
              />
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="h-12 w-full rounded-lg bg-gradient-brand text-base font-bold text-primary-foreground shadow-glow hover:opacity-90"
              >
                {submitting ? "جارٍ الحجز…" : "تأكيد الحجز"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("intro")}
                className="mx-auto flex text-xs text-muted-foreground"
              >
                رجوع
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="animate-in fade-in zoom-in-95 py-2 text-center duration-500">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
                <Check />
              </div>
              <h2 className="mt-4 text-xl font-bold">مكانك محجوز</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                أنت رقم{" "}
                <span className="font-black text-foreground tabular-nums">{position}</span>{" "}
                في قائمة المؤسسين. سنراسلك على بريدك عند الإطلاق مع خصمك الخاص.
              </p>
            </div>
          )}
            </div>
          </aside>
        </section>

        <section className="mt-20 border-t border-border pt-10 sm:mt-28 sm:pt-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold text-primary">مصمم للبيع الحقيقي</p>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">وكيل يفهم عملك، لا يكتفي بالرد</h2>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="join-feature group rounded-xl border border-border bg-card p-6 shadow-card">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
                </span>
                <h3 className="mt-5 text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-14 flex items-center justify-between border-t border-border py-7 text-xs text-muted-foreground" dir="ltr">
          <span className="join-latin font-semibold text-foreground">CUPAI</span>
          <span>© 2026</span>
        </footer>
      </main>
    </div>
  );
}
