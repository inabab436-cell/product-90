import { Fragment, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, ChevronDown, ChevronUp, Plus, Trash2, Loader2, ImageOff, ImagePlus, X, Pencil, Layers, TrendingUp, Boxes, Wallet, PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { PageShell, PageHero, SurfaceCard } from "@/components/layout/page-shell";
import {
  listWebsiteProducts, setProductPublished, uploadProductImage,
  upsertWebsiteProduct, deleteWebsiteProduct, deleteProductImage,
  listProductSales,
  type WebsiteProductDTO,
  type ProductSalesDTO,
} from "@/lib/website-products.functions";
import { addVariantStock, createManualProduct, type ManualVariantInput } from "@/lib/inventory.functions";
import { requireQuantity } from "@/lib/variant-quantity";
import {
  basicFieldsFilled,
  requireMaterial,
  requirePrice,
  requireVariantRows,
} from "@/lib/product-required-fields";




export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "المخزون · cupai" },
      { name: "description", content: "منتجاتك، الألوان، المقاسات، والكميات." },
      { property: "og:title", content: "المخزون · cupai" },
      { property: "og:description", content: "منتجاتك، الألوان، المقاسات، والكميات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

/**
 * Total stock for the whole product = sum of every colour/size quantity.
 * `known` is false when no variant carries a number, so the UI shows
 * "غير محدّد" instead of wrongly claiming the product is sold out.
 */
function totalQty(p: WebsiteProductDTO) {
  let qty = 0;
  let known = false;
  for (const v of p.variants) {
    if (v.quantity != null && Number.isFinite(Number(v.quantity))) {
      qty += Number(v.quantity);
      known = true;
    }
  }
  return { qty, known };
}

/** Compact summary tile above the table. */
function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <SurfaceCard className="flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-lg font-bold leading-tight">{value}</span>
      </span>
    </SurfaceCard>
  );
}

function ProductsPage() {
  const qc = useQueryClient();
  
  const q = useQuery({
    queryKey: ["website-products"],
    queryFn: () => listWebsiteProducts(),
  });
  // Sold pieces per product, read from confirmed orders.
  const salesQ = useQuery({
    queryKey: ["product-sales"],
    queryFn: () => listProductSales(),
    refetchInterval: 60_000,
  });
  const salesById = new Map<string, ProductSalesDTO>(
    (salesQ.data ?? []).map((s) => [s.productId, s]),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  // Keep only the id: the dialog always reads the latest saved product row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quickStock, setQuickStock] = useState<{ product: WebsiteProductDTO; variantIndex: number } | null>(null);
  const pubMut = useMutation({
    mutationFn: (v: { id: string; is_published: boolean }) =>
      setProductPublished({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-products"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل النشر."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteWebsiteProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف المنتج.");
      qc.invalidateQueries({ queryKey: ["website-products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحذف."),
  });


  const rows = q.data ?? [];

  return (
    <PageShell>
      <PageHero
        eyebrow="إدارة المخزون"
        icon={<Package className="h-3.5 w-3.5" />}
        title="كل"
        highlight="منتجاتك"
        description="جدول موحّد لكل منتجاتك مع جدول فرعي لصور الألوان والمقاسات. اضغط على السهم لتوسيع أي منتج."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setAddOpen(true)} className="bg-gradient-brand text-primary-foreground shadow-glow">
              <Plus className="ml-1 h-4 w-4" />
              إضافة منتج
            </Button>
          </div>
        }
      />

      <AddProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          setAddOpen(false);
          toast.success("تم إضافة المنتج إلى المخزون.");
          qc.invalidateQueries({ queryKey: ["website-products"] });
        }}
      />

      <EditProductDialog
        product={rows.find((p) => p.id === editingId) ?? null}
        onOpenChange={(v) => { if (!v) setEditingId(null); }}
        onSaved={() => {
          setEditingId(null);
          toast.success("تم حفظ التعديلات.");
          qc.invalidateQueries({ queryKey: ["website-products"] });
        }}
      />

      <QuickStockDialog
        target={quickStock}
        onOpenChange={(open) => { if (!open) setQuickStock(null); }}
        onSaved={() => {
          setQuickStock(null);
          qc.invalidateQueries({ queryKey: ["website-products"] });
        }}
      />




      {q.isLoading ? (
        <SurfaceCard className="p-10 text-center text-sm text-muted-foreground">جاري التحميل...</SurfaceCard>
      ) : rows.length === 0 ? (
        <SurfaceCard className="p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
            <Package className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            لا توجد منتجات بعد. أضف منتجك الأول يدويًا للبدء.
          </p>
          <Button className="mt-5" onClick={() => setAddOpen(true)}>
            <Plus className="ml-1 h-4 w-4" />إضافة منتج
          </Button>
        </SurfaceCard>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <StatTile
              icon={<Package className="h-4 w-4" />}
              label="عدد المنتجات"
              value={String(rows.length)}
            />
            <StatTile
              icon={<Boxes className="h-4 w-4" />}
              label="إجمالي الكميات"
              value={String(rows.reduce((n, p) => n + totalQty(p).qty, 0))}
            />
            <StatTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="إجمالي المُباع"
              value={String(salesById.size === 0 ? 0 : Array.from(salesById.values()).reduce((n, s) => n + s.sold, 0))}
            />
          </div>

          <SurfaceCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-10 px-3 py-3"></th>
                    <th className="px-4 py-3">المنتج</th>
                    <th className="px-4 py-3">السعر</th>
                    <th className="px-4 py-3">الكمية</th>
                    <th className="px-4 py-3">المُباع</th>
                    <th className="px-4 py-3">المتبقي</th>
                    <th className="px-4 py-3">الألوان / المقاسات</th>
                    <th className="px-4 py-3">أضيف في</th>
                    <th className="px-4 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((p) => {
                    const isOpen = expanded[p.id] === true;
                    const canExpand =
                      p.variants.length > 0 || p.colors.length > 0 || p.sizes.length > 0;
                    const firstImg = p.images[0];
                    const sales = salesById.get(p.id);
                    // Stored variant quantities are ALREADY the remaining stock
                    // (paid orders deduct it), so the total ever available is
                    // remaining + sold — never remaining minus sold.
                    const { qty: remainingQty, known: qtyKnown } = totalQty(p);
                    const sold = sales?.sold ?? 0;
                    const remaining = qtyKnown ? remainingQty : null;
                    const qty = remainingQty + sold;
                    const pct = qty > 0 ? Math.min(100, Math.round((sold / qty) * 100)) : 0;
                    return (
                      <Fragment key={p.id}>
                        <tr
                          className={`transition hover:bg-muted/30 ${isOpen ? "bg-muted/20" : ""}`}
                        >
                          <td className="px-2 py-3 align-middle">
                            {canExpand ? (
                              <button
                                onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !isOpen }))}
                                className={`grid h-7 w-7 place-items-center rounded-lg border transition ${
                                  isOpen
                                    ? "border-primary/50 bg-primary/10 text-primary"
                                    : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                                }`}
                                aria-label={isOpen ? "طي" : "توسيع"}
                              >
                                {isOpen ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {firstImg ? (
                                <img
                                  src={firstImg.url}
                                  alt={p.name}
                                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border/60 shadow-card"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                                  <ImageOff className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{p.name}</span>
                                </div>
                                {p.description && (
                                  <div className="line-clamp-1 max-w-[22ch] text-xs text-muted-foreground">
                                    {p.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {p.price != null ? (
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-gradient-brand">
                                  {p.price} {p.currency ?? ""}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {qtyKnown ? (
                              <span className="inline-flex flex-col">
                                <span className="font-bold">{qty}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  إجمالي كل المتغيّرات
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">غير محدّد</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                <TrendingUp className="h-3 w-3" />
                                {sold} قطعة
                              </span>
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                <span
                                  className="block h-full rounded-full bg-gradient-brand"
                                  style={{ width: `${pct}%` }}
                                />
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs">
                            <StockPill remaining={remaining} />
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="flex flex-wrap items-center gap-1">
                              {p.colors.slice(0, 3).map((c) => (
                                <span
                                  key={c.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5"
                                >
                                  {c.hex && (
                                    <span
                                      className="h-2.5 w-2.5 rounded-full border border-border/60"
                                      style={{ background: c.hex }}
                                    />
                                  )}
                                  {c.label}
                                </span>
                              ))}
                              {p.colors.length > 3 && (
                                <span className="text-muted-foreground">+{p.colors.length - 3}</span>
                              )}
                              {p.sizes.length > 0 && (
                                <span className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  {p.sizes.map((s) => s.label).join(" · ")}
                                </span>
                              )}
                              {p.colors.length === 0 && p.sizes.length === 0 && (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString("ar-EG")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon" variant="secondary" title="تزويد المخزون"
                                onClick={() => setQuickStock({ product: p, variantIndex: 0 })}
                              >
                                <PackagePlus className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon" variant="outline" title="تعديل"
                                onClick={() => setEditingId(p.id)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon" variant="ghost" title="حذف"
                                className="text-destructive hover:text-destructive"
                                disabled={delMut.isPending}
                                onClick={() => {
                                  if (window.confirm(`حذف المنتج "${p.name}" نهائياً؟`)) delMut.mutate(p.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-muted/20">
                            <td colSpan={10} className="p-0">
                              <VariantSubTable product={p} sales={sales} onAddStock={(variantIndex) => setQuickStock({ product: p, variantIndex })} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </>
      )}
    </PageShell>
  );
}

/** Normalised key so an order line ("أحمر"/"M") lines up with a variant row. */
function vKey(color: unknown, size: unknown) {
  const n = (v: unknown) => String(v ?? "").trim().toLocaleLowerCase("ar");
  return `${n(color)}|${n(size)}`;
}

/** Inner table: one row per colour + size with quantity, sold, remaining and images. */
function VariantSubTable({
  product,
  sales,
  onAddStock,
}: {
  product: WebsiteProductDTO;
  sales: ProductSalesDTO | undefined;
  onAddStock: (variantIndex: number) => void;
}) {
  const byColorId = new Map<string, typeof product.images>();
  const bySizeId = new Map<string, typeof product.images>();
  const generic: typeof product.images = [];
  for (const img of product.images) {
    if (img.color_id) {
      const arr = byColorId.get(img.color_id) ?? [];
      arr.push(img);
      byColorId.set(img.color_id, arr);
    } else if (img.size_id) {
      const arr = bySizeId.get(img.size_id) ?? [];
      arr.push(img);
      bySizeId.set(img.size_id, arr);
    } else {
      generic.push(img);
    }
  }

  const colorByLabel = new Map(
    product.colors.map((c) => [String(c.label ?? "").trim().toLocaleLowerCase("ar"), c]),
  );
  const sizeByLabel = new Map(
    product.sizes.map((s) => [String(s.label ?? "").trim().toLocaleLowerCase("ar"), s]),
  );
  const soldByVariant = new Map((sales?.variants ?? []).map((v) => [vKey(v.color, v.size), v.sold]));

  const rows = product.variants.map((v, i) => {
    const color = colorByLabel.get(String(v.color ?? "").trim().toLocaleLowerCase("ar"));
    const size = sizeByLabel.get(String(v.size ?? "").trim().toLocaleLowerCase("ar"));
    const imgs =
      (color ? byColorId.get(color.id) : undefined) ??
      (size ? bySizeId.get(size.id) : undefined) ??
      generic;
    const sold = soldByVariant.get(vKey(v.color, v.size)) ?? 0;
    const qty = v.quantity != null && Number.isFinite(Number(v.quantity)) ? Number(v.quantity) : null;
    return { key: `v-${i}`, label: v.color, hex: color?.hex ?? null, size: v.size, qty, sold, imgs };
  });

  return (
    <div className="border-r-4 border-primary/60 bg-background/60 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Layers className="h-3.5 w-3.5 text-primary" />
        تفاصيل المتغيّرات — لون × مقاس
      </div>
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/80">
        <table className="w-full text-right text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">اللون</th>
              <th className="px-3 py-2">المقاس</th>
              <th className="px-3 py-2">الكمية</th>
              <th className="px-3 py-2">المُباع</th>
              <th className="px-3 py-2">المتبقي</th>
              <th className="px-3 py-2">الصور</th>
              <th className="px-3 py-2">إضافة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  لا توجد متغيّرات مسجّلة لهذا المنتج.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              // r.qty is remaining stock already; total = remaining + sold.
              const remaining = r.qty == null ? null : Math.max(0, r.qty);
              const totalEver = r.qty == null ? null : r.qty + r.sold;
              return (
                <tr key={r.key} className="transition hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.label ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {r.hex && (
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-border/60"
                            style={{ background: r.hex }}
                          />
                        )}
                        {r.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.size ? (
                      <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[11px]">
                        {r.size}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">
                    {totalEver ?? <span className="text-muted-foreground">غير محدّد</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                      <TrendingUp className="h-2.5 w-2.5" />
                      {r.sold}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <StockPill remaining={remaining} />
                  </td>
                  <td className="px-3 py-2">
                    <ImageStrip imgs={r.imgs} label={r.label ?? undefined} />
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => onAddStock(Number(r.key.slice(2)))}>
                      <Plus className="h-3.5 w-3.5" /> كمية
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickStockDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: { product: WebsiteProductDTO; variantIndex: number } | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [amount, setAmount] = useState("1");
  const product = target?.product;
  const variants = product?.variants ?? [];
  const chosen = variants[variantIndex];
  useEffect(() => {
    if (target) {
      setVariantIndex(target.variantIndex);
      setAmount("1");
    }
  }, [target]);
  const add = useMutation({
    mutationFn: () => {
      if (!product) throw new Error("المنتج غير موجود.");
      return addVariantStock({
        data: {
          productId: product.id,
          color: chosen?.color ?? null,
          size: chosen?.size ?? null,
          amount: Number(amount),
        },
      });
    },
    onSuccess: (result) => {
      toast.success(`تم تحديث المخزون إلى ${result.quantity}.`);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذر تحديث المخزون."),
  });

  const open = target != null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="hub max-w-sm">
        <DialogHeader>
          <DialogTitle>تزويد مخزون {product?.name ?? "المنتج"}</DialogTitle>
          <DialogDescription>اختر المتغير والكمية التي تريد إضافتها.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {variants.length > 1 && (
            <label className="block space-y-1.5 text-sm font-semibold">
              <span>اللون أو المقاس</span>
              <select value={variantIndex} onChange={(e) => setVariantIndex(Number(e.target.value))} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                {variants.map((variant, index) => (
                  <option key={`${variant.color ?? ""}-${variant.size ?? ""}-${index}`} value={index}>
                    {[variant.color, variant.size].filter(Boolean).join(" · ") || "المنتج الأساسي"} — المتاح {variant.quantity ?? 0}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block space-y-1.5 text-sm font-semibold">
            <span>الكمية المضافة</span>
            <Input inputMode="numeric" type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 5, 10, 20].map((value) => (
              <Button key={value} type="button" variant="outline" size="sm" onClick={() => setAmount(String(value))}>+{value}</Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || Number(amount) < 1}>
            {add.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            إضافة للمخزون
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Colour-coded remaining-stock badge; `null` means the quantity was never set. */
function StockPill({ remaining }: { remaining: number | null }) {
  if (remaining == null) {
    return <span className="text-xs text-muted-foreground">غير محدّد</span>;
  }
  const tone =
    remaining === 0
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : remaining <= 3
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${tone}`}>
      {remaining === 0 ? "نفدت" : remaining}
    </span>
  );
}


function ImageStrip({ imgs, label }: { imgs: WebsiteProductDTO["images"]; label?: string }) {
  if (imgs.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {imgs.map((img) => (
        <div key={img.id} className="flex flex-col items-center gap-1">
          <img
            src={img.url}
            alt={label ?? ""}
            className="h-14 w-14 rounded-lg border border-border/60 object-cover shadow-card"
            loading="lazy"
          />
          {label && (
            <span className="max-w-[80px] truncate text-[10px] text-muted-foreground" title={label}>
              {label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Add Product dialog — creates a staging_products row inside a fresh
// analysis_batch and redirects the merchant to the batch review page so the
// existing approval flow handles the actual publish.
// ---------------------------------------------------------------------------

/** ONE row = one colour + one size + one quantity. Multi-size rows are not allowed. */
type AddColor = {
  /** Stable image-group key. Rows of the SAME colour share the same gkey, so
   *  every size of that colour is linked to the same colour images. */
  gkey: string;
  label: string;
  size: string;
  quantity: string;
};

let addGroupSeq = 0;
const nextAddGroupKey = () => `a${++addGroupSeq}`;

/** Normalised key used to decide that two images share the same colour. */
function colorKey(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}


function AddProductDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (productId: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");

  const [price, setPrice] = useState("");
  
  const [colors, setColors] = useState<AddColor[]>(() => [{ gkey: nextAddGroupKey(), label: "", size: "", quantity: "" }]);
  // Images picked before the product exists, keyed by colour group key ("g" = intake).
  const [pendingImages, setPendingImages] = useState<Record<string, File[]>>({});
  const [dragOver, setDragOver] = useState(false);

  // Always-fresh view of `colors` for use after awaits.
  const colorsRef = useRef<AddColor[]>(colors);
  colorsRef.current = colors;

  function addColorRow() {
    setColors((rows) => [...rows, { gkey: nextAddGroupKey(), label: "", size: "", quantity: "" }]);
  }
  function addSizeRow(group: AddColor) {
    setColors((rows) => {
      const last = rows.map((row) => row.gkey).lastIndexOf(group.gkey);
      const next = [...rows];
      next.splice(last + 1, 0, { ...group, size: "", quantity: "" });
      return next;
    });
  }

  function removeFile(key: string, index: number) {
    setPendingImages((prev) => ({
      ...prev, [key]: (prev[key] ?? []).filter((_, i) => i !== index),
    }));
  }
  function patchColor(i: number, patch: Partial<AddColor>) {
    setColors((rows) => {
      const target = rows[i];
      if (!target) return rows;
      // Renaming a colour renames every row that shares its image group, so the
      // colour ⇄ image link stays intact across all of its sizes.
      return rows.map((r, j) => {
        if (j === i) return { ...r, ...patch };
        if (patch.label !== undefined && r.gkey === target.gkey) {
          return { ...r, label: patch.label };
        }
        return r;
      });
    });
  }

  function removeGroup(gkey: string) {
    setColors((rows) => rows.filter((r) => r.gkey !== gkey));
    setPendingImages((prev) => {
      const out: Record<string, File[]> = { ...prev, g: [...(prev.g ?? []), ...(prev[gkey] ?? [])] };
      delete out[gkey];
      return out;
    });
  }

  /** Remove a row; if it was the last row of its group, its images go back to intake. */
  function removeColor(i: number) {
    const gone = colorsRef.current[i];
    const rest = colorsRef.current.filter((_, j) => j !== i);
    setColors(rest);
    if (!gone) return;
    if (rest.some((r) => r.gkey === gone.gkey)) return;
    setPendingImages((prev) => {
      const out: Record<string, File[]> = { ...prev, g: [...(prev["g"] ?? []), ...(prev[gone.gkey] ?? [])] };
      delete out[gone.gkey];
      return out;
    });
  }

  /** Move one pending image between the general area and a named colour. */
  function moveFile(fromKey: string, index: number, toKey: string) {
    const file = (pendingImages[fromKey] ?? [])[index];
    if (!file) return;
    const target = toKey;
    if (target === fromKey) return;
    setPendingImages((prev) => ({
      ...prev,
      [fromKey]: (prev[fromKey] ?? []).filter((_, i) => i !== index),
      [target]: [...(prev[target] ?? []), file],
    }));
  }


  function reset() {
    setName(""); setDescription(""); setMaterial(""); setPrice("");
    setColors([{ gkey: nextAddGroupKey(), label: "", size: "", quantity: "" }]); setPendingImages({});
  }


  /** Add selected product images to the unassigned image area. */
  function addIntakeFiles(list: FileList | null) {
    const picked = Array.from(list ?? []).filter((f) => /^image\//i.test(f.type));
    if (picked.length === 0) return;
    setPendingImages((prev) => ({ ...prev, g: [...(prev["g"] ?? []), ...picked] }));
  }



  const createMut = useMutation({
    mutationFn: async () => {
      // Material, price and quantity are mandatory basic fields.
      const materialValue = requireMaterial(material);
      const priceValue = requirePrice(price);
      requireVariantRows(colors.filter((c) => c.label.trim()).length);

      const sizes = Array.from(
        new Set(colors.map((c) => c.size.trim()).filter(Boolean)),
      );
      const colorList = Array.from(
        new Set(colors.map((c) => c.label.trim()).filter(Boolean)),
      );
      const vs: ManualVariantInput[] = [];
      colors.forEach((c) => {
        const label = c.label.trim();
        if (!label) return;
        // Quantity is MANDATORY: a null stock row is later read as
        // "unavailable" and then flips once the merchant fills it in, which is
        // exactly the availability contradiction this guard prevents.
        const qty = requireQuantity(c.quantity, label);
        // Exactly one size per row — no multi-size expansion.
        vs.push({ color: label, size: c.size.trim() || null, quantity: qty });
      });

      const res = await createManualProduct({
        data: {
          name: name.trim(),
          description: description.trim() || null,
          material: materialValue,
          price: priceValue,

          colors: colorList,
          sizes,
          variants: vs,
        },
      });


      // Upload the picked images through the existing product-image upload
      // mechanism, attaching each one to its colour.
      const colorIdByLabel = new Map(
        (res.colors ?? []).map((c) => [c.label.toLowerCase(), c.id] as const),
      );
      for (const [key, files] of Object.entries(pendingImages)) {
        const label =
          key === "g" ? "" : (colors.find((c) => c.gkey === key)?.label ?? "").trim();

        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("productId", res.productId);
          const cid = label ? colorIdByLabel.get(label.toLowerCase()) : null;
          if (cid) fd.append("colorId", cid);
          await uploadProductImage({ data: fd });
        }
      }
      return res;
    },
    onSuccess: (r) => {
      reset();
      onCreated(r.productId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل إنشاء المنتج."),
  });

  function Thumbs({ imgKey }: { imgKey: string }) {
    const files = (pendingImages[imgKey] ?? [])
      .map((f, realIndex) => ({ f, realIndex }));
    if (files.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-3">
        {files.map(({ f, realIndex: k }) => {
          return (
            <div key={`${f.name}-${k}`} className="flex flex-col items-center gap-1">
              <div className="relative">
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="h-16 w-16 rounded-lg border border-border/60 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeFile(imgKey, k)}
                  className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-destructive-foreground"
                  aria-label="حذف الصورة"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
              <select
                aria-label="لون الصورة"
                className="h-7 w-24 rounded-md border border-border/60 bg-background px-1 text-[10px]"
                value={colors.some((c) => c.gkey === imgKey && c.label.trim()) ? imgKey : "g"}
                onChange={(e) => moveFile(imgKey, k, e.target.value)}
              >
                <option value="g">اختر اللون</option>
                {Array.from(new Map(colors.filter((c) => c.label.trim()).map((c) => [colorKey(c.label), c] as const)).values()).map(
                  (c) => (
                    <option key={c.gkey} value={c.gkey}>
                      {c.label.trim()}
                    </option>
                  ),
                )}
              </select>

            </div>

          );
        })}
      </div>
    );
  }

  function AllPendingImages() {
    return (
      <div className="space-y-3">
        {Object.keys(pendingImages).map((key) => (
          <Thumbs key={key} imgKey={key} />
        ))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent dir="rtl" className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة منتج جديد</DialogTitle>
          <DialogDescription>
            أدخل بيانات المنتج وارفع صوره، ثم اربط كل صورة بلونها.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic info */}
          <section className="space-y-3 border-b border-border pb-5">
            <h4 className="text-sm font-semibold">١. بيانات المنتج</h4>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">اسم المنتج *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تيشيرت قطن" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الوصف</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              <p className="text-[10px] text-muted-foreground">
                الوصف بدون لون — الألوان تُدار في خانة الألوان بالأسفل.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">الخامة *</label>
                <Input
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="مثال: قطن ١٠٠٪"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">السعر (ج.م) *</label>

                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
          </section>


          {/* Colours */}
          <section className="space-y-3 border-b border-border pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">٢. الألوان والمقاسات والكميات</h4>
              <Button
                size="sm" variant="outline" type="button"
                onClick={() => addColorRow()}
              >
                <Plus className="ml-1 h-3.5 w-3.5" /> إضافة لون
              </Button>
            </div>
            {Array.from(new Map(colors.map((c) => [c.gkey, c] as const)).values()).map((group) => (
              <div key={group.gkey} className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1 text-xs font-medium">اللون
                    <Input value={group.label} placeholder="مثال: أحمر" onChange={(e) => patchColor(colors.findIndex((c) => c.gkey === group.gkey), { label: e.target.value })} />
                  </label>
                  <Button size="icon" variant="ghost" type="button" aria-label="حذف اللون" onClick={() => removeGroup(group.gkey)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {colors.map((c, i) => c.gkey === group.gkey && (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground">المقاس
                      <Input value={c.size} placeholder="اختياري" onChange={(e) => patchColor(i, { size: e.target.value })} />
                    </label>
                    <label className="min-w-0 space-y-1 text-xs text-muted-foreground">الكمية *
                      <Input type="number" min={0} required value={c.quantity} placeholder="0" onChange={(e) => patchColor(i, { quantity: e.target.value })} />
                    </label>
                    <Button size="icon" variant="ghost" type="button" aria-label="حذف المقاس" disabled={colors.filter((r) => r.gkey === group.gkey).length === 1} onClick={() => removeColor(i)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" type="button" onClick={() => addSizeRow(group)}><Plus className="ml-1 h-3.5 w-3.5" /> إضافة مقاس</Button>
              </div>
            ))}
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">٣. صور المنتج</h4>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-5 text-center transition hover:border-primary data-[dragging=true]:border-primary" data-dragging={dragOver || undefined} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); addIntakeFiles(e.dataTransfer.files); }}>
              <ImagePlus className="h-7 w-7 text-primary" />
              <span className="text-sm font-medium">رفع صور المنتج بمختلف ألوانه</span>
              <span className="text-xs text-muted-foreground">اختر عدة صور أو اسحبها هنا</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addIntakeFiles(e.target.files); e.currentTarget.value = ""; }} />
            </label>
            <AllPendingImages />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() => createMut.mutate()}
            disabled={
              createMut.isPending ||
              !basicFieldsFilled({
                name, material, price,
                rows: colors.filter((c) => c.label.trim() && c.quantity.trim()).length,
              })
            }

          >
            {createMut.isPending && <Loader2 className="ml-1 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ---------------------------------------------------------------------------
// Edit Product dialog — edits the core fields, the colour/size lists, and the
// images attached to each colour. Uses the existing product server functions
// only (upsert / upload image / delete image); the automatic description
// generation keeps running exactly as before (it is triggered by the same
// image-upload path and by the existing freshness sweep).
// ---------------------------------------------------------------------------

type EditColor = {
  id?: string;
  /** Stable local key: pending (unsaved) images are grouped by this, so a
   *  rename never loses the images attached to the group. */
  gkey: string;
  label: string;
  hex: string | null;
  /** Exactly ONE size per row. */
  size: string;
  quantity: string;
};

let editGroupSeq = 0;
const nextGroupKey = () => `g${++editGroupSeq}`;

function EditProductDialog({
  product, onOpenChange, onSaved,
}: {
  product: WebsiteProductDTO | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [material, setMaterial] = useState("");

  const [price, setPrice] = useState("");
  const [colors, setColors] = useState<EditColor[]>([]);
  
  // New images picked in this session, keyed by colour group key ("" = general).
  const [pending, setPending] = useState<Record<string, File[]>>({});
  /** Saved images manually moved to a colour in this editing session. */
  const [savedAssign, setSavedAssign] = useState<Record<string, string>>({});
  const [loadedId, setLoadedId] = useState<string | null>(null);


  const colorsRef = useRef<EditColor[]>(colors);
  colorsRef.current = colors;
  const pendingRef = useRef<Record<string, File[]>>(pending);
  pendingRef.current = pending;

  // Load the product into the form when it changes (no effect needed: the
  // dialog is keyed by the product id we last hydrated from).
  if (product && loadedId !== product.id) {
    setLoadedId(product.id);
    setName(product.name);
    setDescription(product.description ?? "");
    setMaterial(product.material ?? "");

    setPrice(product.price != null ? String(product.price) : "");
    // One row per (colour, size) pair — a colour with three sizes becomes three
    // independent rows, each with its own quantity.
    setColors(
      product.colors.flatMap((c) => {
        const vs = product.variants.filter(
          (v) => (v.color ?? "").toLowerCase() === c.label.toLowerCase(),
        );
        const base = { id: c.id, label: c.label, hex: c.hex, gkey: nextGroupKey() };
        if (vs.length === 0) {
          return [{ ...base, size: "", quantity: "" }];
        }
        return vs.map((v) => ({
          ...base,
          gkey: base.gkey,
          size: v.size ?? "",
          quantity: v.quantity != null ? String(v.quantity) : "",
        }));
      }),
    );
    setPending({});
    setSavedAssign({});

  }

  const delImg = useMutation({
    mutationFn: (imageId: string) => deleteProductImage({ data: { imageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["website-products"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حذف الصورة."),
  });



  const save = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const cleanColors = colors.filter((c) => c.label.trim());
      // Material, price and quantity stay mandatory when editing too.
      const materialValue = requireMaterial(material);
      const priceValue = requirePrice(price);
      requireVariantRows(cleanColors.length);

      const allSizes = Array.from(
        new Set(cleanColors.map((c) => c.size.trim()).filter(Boolean)),
      );
      const variants: { color: string | null; size: string | null; quantity: number | null }[] = [];
      for (const c of cleanColors) {
        const label = c.label.trim();
        const qty = requireQuantity(c.quantity, label);
        // One row = one colour + one size + one quantity.
        variants.push({ color: label, size: c.size.trim() || null, quantity: qty });
      }
      const labelByKeyAll = new Map(colors.map((c) => [c.gkey, c.label.trim()] as const));
      const res = await upsertWebsiteProduct({
        data: {
          id: product.id,
          name: name.trim(),
          description: description.trim() || null,
          material: materialValue,

          price: priceValue,

          currency: product.currency,
          sizes: allSizes.map((label) => ({ label })),
          colors: cleanColors.map((c) => ({ label: c.label.trim(), hex: c.hex })),
          variants,
          // Persist any saved-image colour assignments made in this editor.
          imageColorAssignments: Object.entries(savedAssign)
            .map(([imageId, gkey]) => ({ imageId, colorLabel: labelByKeyAll.get(gkey) ?? "" }))
            .filter((a) => a.colorLabel),
        },
      });
      const idByLabel = new Map((res.colors ?? []).map((c) => [c.label.toLowerCase(), c.id] as const));
      const labelByKey = labelByKeyAll;
      for (const [gkey, files] of Object.entries(pending)) {
        const label = gkey === "" ? "" : (labelByKey.get(gkey) ?? "");
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("productId", product.id);
          const cid = label ? idByLabel.get(label.toLowerCase()) : null;
          if (cid) fd.append("colorId", cid);
          await uploadProductImage({ data: fd });
        }
      }
    },
    onSuccess: () => { setLoadedId(null); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل حفظ التعديلات."),
  });

  if (!product) return null;

  function addColorRow() {
    setColors((rows) => [...rows, { gkey: nextGroupKey(), label: "", hex: null, size: "", quantity: "" }]);
  }
  function addSizeRow(group: EditColor) {
    setColors((rows) => {
      const last = rows.map((row) => row.gkey).lastIndexOf(group.gkey);
      const next = [...rows];
      next.splice(last + 1, 0, { ...group, size: "", quantity: "" });
      return next;
    });
  }

  /** Delete a colour group; its unsaved images fall back to the general area. */
  function removeColorGroup(i: number) {
    const gkey = colorsRef.current[i]?.gkey;
    setColors((rows) => rows.filter((_, j) => j !== i));
    if (!gkey) return;
    if (colorsRef.current.some((row, j) => j !== i && row.gkey === gkey)) return;
    setSavedAssign((prev) => {
      const out = { ...prev };
      for (const [imgId, k] of Object.entries(out)) if (k === gkey) delete out[imgId];
      return out;
    });
    setPending((prev) => {
      const out: Record<string, File[]> = { ...prev, "": [...(prev[""] ?? []), ...(prev[gkey] ?? [])] };
      delete out[gkey];
      return out;

    });

  }

  function removeGroup(gkey: string) {
    setColors((rows) => rows.filter((row) => row.gkey !== gkey));
    setSavedAssign((prev) => {
      const next = { ...prev };
      for (const [id, key] of Object.entries(next)) if (key === gkey) delete next[id];
      return next;
    });
    setPending((prev) => {
      const next: Record<string, File[]> = { ...prev, "": [...(prev[""] ?? []), ...(prev[gkey] ?? [])] };
      delete next[gkey];
      return next;
    });
  }

  /** Move one unsaved image between the general area and a named colour. */
  function moveFile(fromKey: string, index: number, toKey: string) {
    const file = (pendingRef.current[fromKey] ?? [])[index];
    if (!file) return;
    const target = toKey;
    if (target === fromKey) return;
    setPending((prev) => ({
      ...prev,
      [fromKey]: (prev[fromKey] ?? []).filter((_, i) => i !== index),
      [target]: [...(prev[target] ?? []), file],
    }));
  }

  /** Add selected product images to the unassigned image area. */
  function addIntakeFiles(list: FileList | null) {
    const picked = Array.from(list ?? []).filter((f) => /^image\//i.test(f.type));
    if (picked.length === 0) return;
    setPending((prev) => ({ ...prev, "": [...(prev[""] ?? []), ...picked] }));
  }



  /** Group picker rendered under each unsaved thumbnail. */
  function GroupPicker({ fromKey, index }: { fromKey: string; index: number }) {
    return (
      <select
        aria-label="لون الصورة"
        className="mt-1 h-7 w-24 rounded-md border border-border/60 bg-background px-1 text-[10px]"
        value={colors.some((c) => c.gkey === fromKey && c.label.trim()) ? fromKey : ""}
        onChange={(e) => moveFile(fromKey, index, e.target.value)}
      >
        <option value="">اختر اللون</option>
        {Array.from(new Map(colors.filter((c) => c.label.trim()).map((c) => [colorKey(c.label), c] as const)).values()).map((c) => (
          <option key={c.gkey} value={c.gkey}>{c.label.trim()}</option>
        ))}
      </select>
    );
  }

  function SavedImageColorPicker({ imageId, value = "" }: { imageId: string; value?: string }) {
    return (
      <select
        aria-label="لون الصورة"
        className="mt-1 h-6 w-20 rounded-md border border-border/60 bg-background px-1 text-[9px]"
        value={savedAssign[imageId] ?? value}
        onChange={(e) => setSavedAssign((prev) => ({ ...prev, [imageId]: e.target.value }))}
      >
        <option value="">بدون لون</option>
        {Array.from(new Map(colors.filter((c) => c.label.trim()).map((c) => [colorKey(c.label), c] as const)).values()).map((c) => (
          <option key={c.gkey} value={c.gkey}>{c.label.trim()}</option>
        ))}
      </select>
    );
  }

  return (
    <Dialog open={!!product} onOpenChange={(v) => { if (!v) setLoadedId(null); onOpenChange(v); }}>
      <DialogContent dir="rtl" className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل المنتج</DialogTitle>
          <DialogDescription>
            عدّل البيانات والألوان والمقاسات، وأدر صور كل لون. الصور الجديدة تُرفع عند الحفظ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 border-b border-border pb-4">
            <h4 className="text-sm font-semibold">١. بيانات المنتج</h4>
            <div className="space-y-1.5"><label className="text-xs font-medium">اسم المنتج *</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><label className="text-xs font-medium">الوصف</label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><label className="text-xs font-medium">الخامة *</label><Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="مثال: قطن ١٠٠٪" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">السعر *</label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            </div>
          </div>

          <div className="space-y-3 border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">٢. الألوان والمقاسات والكميات</h4><Button size="sm" variant="outline" type="button" onClick={addColorRow}><Plus className="ml-1 h-3.5 w-3.5" /> إضافة لون</Button></div>
            {Array.from(new Map(colors.map((c) => [c.gkey, c] as const)).values()).map((group) => (
              <div key={group.gkey} className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-end gap-2"><label className="min-w-0 flex-1 space-y-1 text-xs font-medium">اللون<Input value={group.label} placeholder="مثال: أحمر" onChange={(e) => setColors((rows) => rows.map((r) => r.gkey === group.gkey ? { ...r, label: e.target.value } : r))} /></label><Button size="icon" variant="ghost" type="button" aria-label="حذف اللون" onClick={() => removeGroup(group.gkey)}><Trash2 className="h-4 w-4" /></Button></div>
                {colors.map((c, i) => c.gkey === group.gkey && <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                  <label className="min-w-0 space-y-1 text-xs text-muted-foreground">المقاس<Input value={c.size} placeholder="اختياري" onChange={(e) => setColors((rows) => rows.map((r, j) => j === i ? { ...r, size: e.target.value } : r))} /></label>
                  <label className="min-w-0 space-y-1 text-xs text-muted-foreground">الكمية *<Input type="number" min={0} required placeholder="0" value={c.quantity} onChange={(e) => setColors((rows) => rows.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} /></label>
                  <Button size="icon" variant="ghost" type="button" aria-label="حذف المقاس" disabled={colors.filter((r) => r.gkey === group.gkey).length === 1} onClick={() => removeColorGroup(i)}><X className="h-4 w-4" /></Button>
                </div>)}
                <Button size="sm" variant="ghost" type="button" onClick={() => addSizeRow(group)}><Plus className="ml-1 h-3.5 w-3.5" /> إضافة مقاس</Button>
              </div>
            ))}
          </div>

          {/* One image area shared by every colour. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">٣. صور المنتج</span>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] hover:border-primary/40 hover:text-primary">
                <ImagePlus className="h-3.5 w-3.5" /> رفع صور
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { addIntakeFiles(e.target.files); e.currentTarget.value = ""; }} />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              ارفع الصور، ثم اختر لون كل صورة من القائمة أسفلها.
            </p>
            <div className="flex flex-wrap gap-2">
              {product.images.map((img) => {
                const linkedColor = colors.find((c) => c.id === img.color_id);
                return (
                <div key={img.id} className="relative">
                  <img src={img.url} alt="" className="h-14 w-14 rounded-lg border border-border/60 object-cover" />
                  <button type="button" aria-label="حذف الصورة"
                    onClick={() => delImg.mutate(img.id)}
                    className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-destructive-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <SavedImageColorPicker imageId={img.id} value={linkedColor?.gkey ?? ""} />
                </div>
                );
              })}
              {Object.entries(pending).flatMap(([fromKey, files]) => files.map((f, k) => (
                  <div key={`pg-${k}`} className="relative">
                    <img src={URL.createObjectURL(f)} alt={f.name}
                      className="h-14 w-14 rounded-lg border border-dashed border-primary/50 object-cover" />
                    <button type="button" aria-label="إزالة"
                      onClick={() => setPending((prev) => ({ ...prev, [fromKey]: (prev[fromKey] ?? []).filter((_, j) => j !== k) }))}
                      className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-destructive-foreground">
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <GroupPicker fromKey={fromKey} index={k} />
                  </div>
              )))}
            </div>
          </div>

        </div>


        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              !basicFieldsFilled({
                name, material, price,
                rows: colors.filter((c) => c.label.trim() && c.quantity.trim()).length,
              })
            }
          >

            {save.isPending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

