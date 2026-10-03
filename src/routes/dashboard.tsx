import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Package, Truck, PhoneCall, Globe, ArrowLeft, CreditCard,
  ShoppingBag, BadgePercent, MessagesSquare, MailCheck, Users, LayoutGrid,
} from "lucide-react";

import { HubTabBar } from "@/components/hub/hub-shell";
import logo from "@/assets/cupai-logo.png.asset.json";
import { SiteIdentity, SiteSettingsButton, SiteLinkCard } from "@/components/website/site-link-bar";
import { useHubBadges, badgeText } from "@/lib/hub-badges";
import { getCurrentActor } from "@/lib/staff.functions";
import { hasPermission, type StaffPermission } from "@/lib/staff-types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم · cupai" },
      { name: "description", content: "أدر منتجاتك، سياساتك، شحنك، وبيانات تواصلك." },
      { property: "og:title", content: "لوحة التحكم · cupai" },
      { property: "og:description", content: "ملخص الطلبات والعملاء وإدارة المتجر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

type Tile = {
  to: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  tone: string;
  /** Permission required to open this tile. */
  perm: StaffPermission;
};

const TILES: Tile[] = [
  { to: "/orders", label: "الطلبات", description: "متابعة وتجهيز", icon: <ShoppingBag className="h-5 w-5" />, tone: "bg-dashboard-blue-soft text-dashboard-blue", perm: "orders" },
  { to: "/conversations", label: "المحادثات", description: "تواصل مع عملائك", icon: <MessagesSquare className="h-5 w-5" />, tone: "bg-dashboard-rose-soft text-dashboard-rose", perm: "orders" },
  { to: "/products", label: "المخزون", description: "المنتجات والكميات", icon: <Package className="h-5 w-5" />, tone: "bg-dashboard-green-soft text-dashboard-green", perm: "brand_data" },
  { to: "/published", label: "الموقع", description: "واجهة متجرك", icon: <Globe className="h-5 w-5" />, tone: "bg-dashboard-blue-soft text-dashboard-blue", perm: "settings" },
  { to: "/offers", label: "العروض", description: "الخصومات الحالية", icon: <BadgePercent className="h-5 w-5" />, tone: "bg-dashboard-amber-soft text-dashboard-amber", perm: "brand_data" },
  { to: "/shipping", label: "الشحن", description: "المناطق والتكلفة", icon: <Truck className="h-5 w-5" />, tone: "bg-dashboard-blue-soft text-dashboard-blue", perm: "brand_data" },
  { to: "/settings/payment-methods", label: "الدفع", description: "طرق استلام المال", icon: <CreditCard className="h-5 w-5" />, tone: "bg-dashboard-rose-soft text-dashboard-rose", perm: "settings" },
  { to: "/contacts", label: "التواصل", description: "بيانات الاتصال", icon: <PhoneCall className="h-5 w-5" />, tone: "bg-dashboard-blue-soft text-dashboard-blue", perm: "brand_data" },
];

function DashboardPage() {
  const actorQuery = useQuery({
    queryKey: ["current-actor"],
    queryFn: () => getCurrentActor(),
    staleTime: 60_000,
  });
  const actor = actorQuery.data ?? null;
  const can = (perm: StaffPermission) => (actor ? hasPermission(actor, perm) : false);
  const isOwner = actor?.isOwner ?? false;

  const { orders, newOrders, pendingChats } = useHubBadges(!!actor && can("orders"));
  const visibleTiles = useMemo(() => TILES.filter((t) => can(t.perm)), [actor]);
  const badgeFor = (to: string) =>
    to === "/orders" ? newOrders : to === "/conversations" ? pendingChats : 0;

  const orderCount = orders.data?.filter((order) => order.status !== "cancelled").length ?? 0;

  return (
    <div dir="rtl" className="hub hub-dashboard min-h-screen pb-24 lg:pb-0">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 border-l border-border bg-card p-5 lg:flex lg:flex-col">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <img src={logo.url} alt="cupai" className="h-10 w-10 shrink-0 rounded-lg" />
          <span>
            <span className="block text-sm font-bold">متجرك</span>
            <span className="hub-latin block text-[10px] text-muted-foreground">CUPAI</span>
          </span>
        </Link>
        <nav className="space-y-1" aria-label="التنقل الرئيسي">
          <Link to="/dashboard" className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground">
            <LayoutGrid className="h-[18px] w-[18px]" /> الرئيسية
          </Link>
          {visibleTiles.map((tile) => (
            <Link key={tile.to} to={tile.to as never} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <span className="grid h-7 w-7 place-items-center">{tile.icon}</span>
              <span className="flex-1">{tile.label}</span>
              <CountBadge n={badgeFor(tile.to)} />
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-4 text-xs text-muted-foreground">
          إدارة متجرك من مكان واحد
        </div>
      </aside>

      <div className="lg:mr-64">
        <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <SiteIdentity fallbackLogo={logo.url} />
            <div className="flex shrink-0 items-center gap-2">
              {can("brand_data") && <SiteSettingsButton />}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-6 lg:py-8">
          <SiteLinkCard />
          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold text-primary">اليوم في متجرك</p>
              <h2 className="mt-1 text-2xl font-bold">مرحباً بك</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {can("orders") && (
                <Link to="/orders" className="dashboard-summary-card group">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-dashboard-blue-soft text-dashboard-blue"><ShoppingBag className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">إجمالي الطلبات</span>
                    <span className="dashboard-number mt-1 block text-2xl font-bold">{orders.isLoading ? "—" : orderCount}</span>
                  </span>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
                </Link>
              )}
            </div>
          </section>

          {visibleTiles.length > 0 && (
            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <div><p className="text-xs text-muted-foreground">كل ما تحتاجه</p><h2 className="mt-1 text-base font-bold">الوصول السريع</h2></div>
                <span className="text-xs text-muted-foreground">{visibleTiles.length} أدوات</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {visibleTiles.map((tile) => (
                  <Link key={tile.to} to={tile.to as never} className="group relative flex min-h-32 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30">
                    <CountBadge n={badgeFor(tile.to)} className="absolute left-3 top-3" />
                    <span className={`grid h-10 w-10 place-items-center rounded-lg ${tile.tone}`}>{tile.icon}</span>
                    <span className="mt-5 min-w-0">
                      <span className="block text-sm font-bold">{tile.label}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{tile.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid items-start gap-6 lg:max-w-md">
            <section>
              <h2 className="mb-3 text-sm font-bold">إدارة الحساب</h2>
              <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
                {can("settings") && (
                  <Link to="/settings/notifications" className="flex items-center gap-3 border-b border-border p-4 transition-colors hover:bg-muted/60">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground"><MailCheck className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">إشعارات البريد</span>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )}
                {isOwner && (
                  <Link to="/team" className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-foreground"><Users className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1 text-sm font-semibold">الفريق والصلاحيات</span>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </Link>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <div className="lg:hidden"><HubTabBar /></div>
    </div>
  );
}

function CountBadge({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={`grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground ${className}`}>
      {badgeText(n)}
    </span>
  );
}
