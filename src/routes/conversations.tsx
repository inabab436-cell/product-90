import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCheck, Search, Send, CreditCard, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  listConversations,
  getConversationDetail,
  sendMerchantReply,
  confirmPaymentAndResumeAgent,
  type ConversationRow,
} from "@/lib/conversations.functions";

export const Route = createFileRoute("/conversations")({
  validateSearch: z.object({ c: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "المحادثات · cupai" },
      { name: "description", content: "تواصل مع عملائك وأكمل الدفع معهم من مكان واحد." },
      { property: "og:title", content: "المحادثات · cupai" },
      { property: "og:description", content: "صندوق محادثات التاجر مع العملاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversationsPage,
});

function displayName(c: { customer_name: string | null; visitor_number: number | null }) {
  return c.customer_name?.trim() || (c.visitor_number ? `زائر ${c.visitor_number}` : "عميل");
}

function shortTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {name.trim().charAt(0) || "؟"}
    </span>
  );
}

function ConversationsPage() {
  const { c: selectedId } = Route.useSearch();
  const navigate = useNavigate({ from: "/conversations" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "payment">("all");

  const list = useQuery({
    queryKey: ["conversations"],
    queryFn: () => listConversations(),
    refetchInterval: 10000,
  });

  const rows = useMemo(() => {
    const all = [...(list.data ?? [])].sort((a, b) =>
      (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at),
    );
    return all.filter((r) => {
      if (filter === "payment" && !r.awaiting_payment) return false;
      if (!query.trim()) return true;
      return displayName(r).includes(query.trim()) || (r.last_message_preview ?? "").includes(query.trim());
    });
  }, [list.data, query, filter]);

  const paymentCount = (list.data ?? []).filter((r) => r.awaiting_payment).length;
  const select = (id?: string) => navigate({ search: id ? { c: id } : {} });

  return (
    <div dir="rtl" className="hub flex h-[100dvh] overflow-hidden bg-background">
      {/* Inbox */}
      <aside className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col border-l border-border bg-card md:w-[360px]`}>
        <header className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">المحادثات</h1>
            <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-4 w-4" /> لوحة التحكم
            </Link>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن عميل أو رسالة"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex gap-2">
            {([["all", "الكل"], ["payment", `بانتظار الدفع${paymentCount ? ` (${paymentCount})` : ""}`]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {list.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>}
          {!list.isLoading && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات.</p>
          )}
          {rows.map((r) => (
            <InboxRow key={r.id} row={r} active={r.id === selectedId} onClick={() => select(r.id)} />
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {selectedId ? (
          <Thread key={selectedId} id={selectedId} onBack={() => select(undefined)} />
        ) : (
          <div className="m-auto flex flex-col items-center gap-3 text-muted-foreground">
            <MessagesSquare className="h-10 w-10" />
            <p className="text-sm">اختر محادثة للبدء</p>
          </div>
        )}
      </section>
    </div>
  );
}

function InboxRow({ row, active, onClick }: { row: ConversationRow; active: boolean; onClick: () => void }) {
  const name = displayName(row);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-right transition-colors ${active ? "bg-primary/10" : "hover:bg-muted/60"}`}
    >
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{name}</span>
          <span className="ms-auto shrink-0 text-[11px] text-muted-foreground">{shortTime(row.last_message_at ?? row.created_at)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="truncate text-xs text-muted-foreground">{row.last_message_preview || "—"}</span>
          {row.awaiting_payment && (
            <span className="ms-auto shrink-0 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">دفع</span>
          )}
        </span>
      </span>
    </button>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const detail = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => getConversationDetail({ data: { id } }),
    refetchInterval: 5000,
  });

  const send = useMutation({
    mutationFn: (content: string) => sendMerchantReply({ data: { id, content } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => toast.error(e?.message || "تعذر إرسال الرسالة"),
  });

  const confirm = useMutation({
    mutationFn: () => confirmPaymentAndResumeAgent({ data: { id } }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (res?.ok === false) {
        toast.error(res.error === "insufficient_stock" ? "الكمية غير متاحة الآن، لم يتم تأكيد الدفع." : "تعذر تأكيد الدفع.");
        return;
      }
      toast.success("تم تأكيد الدفع");
    },
    onError: (e: any) => toast.error(e?.message || "تعذر تأكيد الدفع"),
  });

  const msgs = detail.data?.messages ?? [];
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  const submit = () => {
    const v = text.trim();
    if (v && !send.isPending) send.mutate(v);
  };

  const name = detail.data ? displayName(detail.data) : "…";

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted md:hidden" aria-label="رجوع">
          <ArrowRight className="h-5 w-5" />
        </button>
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          {detail.data?.awaiting_payment && <p className="text-[11px] text-destructive">بانتظار استكمال الدفع</p>}
        </div>
        {detail.data?.awaiting_payment && (
          <Button size="sm" onClick={() => confirm.mutate()} disabled={confirm.isPending} className="gap-1.5">
            <CreditCard className="h-4 w-4" /> تأكيد الدفع
          </Button>
        )}
      </header>

      <div className="flex-1 space-y-1.5 overflow-y-auto bg-muted/40 px-3 py-4">
        {detail.isLoading && <p className="text-center text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {msgs.map((m) => {
          const mine = m.role !== "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                  mine ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-card text-card-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {shortTime(m.created_at)}
                  {mine && <CheckCheck className="h-3 w-3" />}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-end gap-2 border-t border-border bg-card p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={1}
          placeholder="اكتب رسالة…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl bg-muted px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || send.isPending} className="h-11 w-11 shrink-0 rounded-full" aria-label="إرسال">
          <Send className="h-5 w-5 -scale-x-100" />
        </Button>
      </form>
    </>
  );
}
