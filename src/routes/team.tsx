import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Users,
  UserPlus,
  Trash2,
  ShieldCheck,
  Link2,
  Copy,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import logo from "@/assets/cupai-logo.png.asset.json";
import {
  listStaffMembers,
  addStaffMember,
  updateStaffMember,
  removeStaffMember,
} from "@/lib/staff.functions";
import {
  buildInviteUrl,
  PERMISSION_LABELS,
  STAFF_PERMISSIONS,
  STATUS_LABELS,
  type StaffMember,
  type StaffPermission,
} from "@/lib/staff-types";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "الفريق · cupai" },
      {
        name: "description",
        content: "أضف موظفين وحدّد صلاحية كل واحد منهم داخل لوحة التحكم.",
      },
      { property: "og:title", content: "الفريق · cupai" },
      {
        property: "og:description",
        content: "إدارة الموظفين والصلاحيات: المحادثات، الأوردرات، بيانات البراند.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function permissionSummary(member: StaffMember): string {
  if (member.full_access) return "وصول كامل";
  if (member.permissions.length === 0) return "بدون صلاحيات";
  return member.permissions.map((p) => PERMISSION_LABELS[p].title).join(" · ");
}

interface DraftState {
  name: string;
  email: string;
  fullAccess: boolean;
  permissions: StaffPermission[];
}

const EMPTY_DRAFT: DraftState = {
  name: "",
  email: "",
  fullAccess: false,
  permissions: [],
};

function PermissionPicker({
  value,
  fullAccess,
  onToggle,
  onFullAccess,
  disabled,
}: {
  value: StaffPermission[];
  fullAccess: boolean;
  onToggle: (key: StaffPermission, on: boolean) => void;
  onFullAccess: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" />
            وصول كامل
          </div>
          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
            كل شيء مثل صاحب الحساب، ما عدا إدارة الفريق نفسه.
          </div>
        </div>
        <Switch
          checked={fullAccess}
          disabled={disabled}
          onCheckedChange={(v) => onFullAccess(!!v)}
        />
      </div>

      <ul
        className={
          "divide-y divide-border/60 rounded-xl border border-border/60" +
          (fullAccess ? " pointer-events-none opacity-50" : "")
        }
      >
        {STAFF_PERMISSIONS.map((key) => (
          <li key={key} className="flex items-center justify-between gap-4 p-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{PERMISSION_LABELS[key].title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {PERMISSION_LABELS[key].description}
              </div>
            </div>
            <Switch
              checked={fullAccess || value.includes(key)}
              disabled={disabled || fullAccess}
              onCheckedChange={(v) => onToggle(key, !!v)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function InviteLink({ member }: { member: StaffMember }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = origin ? buildInviteUrl(origin, member.invite_token) : "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ الرابط.");
    } catch {
      toast.error("تعذّر النسخ، انسخ الرابط يدويًا.");
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        رابط دخول الموظف
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span dir="ltr" className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {url || "…"}
        </span>
        <Button variant="secondary" size="sm" className="h-7 px-2" onClick={copy}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TeamPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["staff-members"], queryFn: () => listStaffMembers() });

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(EMPTY_DRAFT);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["staff-members"] });
  const fail = (e: unknown, fallback: string) =>
    toast.error((e as Error)?.message || fallback);

  const addM = useMutation({
    mutationFn: () =>
      addStaffMember({
        data: {
          name: draft.name,
          permissions: draft.permissions,
          full_access: draft.fullAccess,
        },
      }),
    onSuccess: () => {
      toast.success("تمت إضافة الموظف.");
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      invalidate();
    },
    onError: (e) => fail(e, "تعذّر إضافة الموظف."),
  });

  const saveM = useMutation({
    mutationFn: (id: string) =>
      updateStaffMember({
        data: {
          id,
          name: editDraft.name,
          permissions: editDraft.permissions,
          full_access: editDraft.fullAccess,
        },
      }),
    onSuccess: () => {
      toast.success("تم تحديث الصلاحيات.");
      setEditingId(null);
      invalidate();
    },
    onError: (e) => fail(e, "تعذّر تحديث الصلاحيات."),
  });

  const statusM = useMutation({
    mutationFn: (input: { id: string; status: "active" | "disabled" }) =>
      updateStaffMember({ data: input }),
    onSuccess: () => {
      toast.success("تم تحديث حالة الموظف.");
      invalidate();
    },
    onError: (e) => fail(e, "تعذّر تحديث حالة الموظف."),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => removeStaffMember({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الموظف.");
      invalidate();
    },
    onError: (e) => fail(e, "تعذّر حذف الموظف."),
  });

  function startEdit(member: StaffMember) {
    setEditingId(member.id);
    setEditDraft({
      name: member.name,
      email: member.email ?? "",
      fullAccess: member.full_access,
      permissions: member.permissions,
    });
  }

  const ownerOnly = /صاحب الحساب فقط/.test((q.error as Error)?.message ?? "");
  const members = q.data?.members ?? [];

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
        <section className="flex items-start gap-3">
          <div className="rounded-xl bg-gradient-brand p-2.5 text-primary-foreground shadow-glow">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">الفريق</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              أضف موظفًا بصلاحيات محددة، أرسل له الرابط ليسجّل بنفسه، وعدّل صلاحياته
              أو أوقفها في أي وقت.
            </p>
          </div>
        </section>

        {ownerOnly ? (
          <section className="rounded-2xl border border-border/60 bg-background/80 p-6 text-center text-sm text-muted-foreground shadow-card">
            إدارة الفريق متاحة لصاحب الحساب فقط.
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-card">
                <div className="text-xs text-muted-foreground">عدد الموظفين</div>
                <div className="mt-1 text-2xl font-bold">{q.data?.total ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-card">
                <div className="text-xs text-muted-foreground">النشِطون</div>
                <div className="mt-1 text-2xl font-bold">{q.data?.active ?? 0}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-background/80 shadow-card">
              {adding ? (
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">إضافة موظف</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAdding(false);
                        setDraft(EMPTY_DRAFT);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3">
                    <Input
                      placeholder="اسم الموظف"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    بعد الإضافة سيظهر رابط خاص بالموظف. أرسل له الرابط، وهو الذي يسجّل
                    بياناته بنفسه، ثم يفتح على الأقسام المسموح بها فقط.
                  </p>

                  <PermissionPicker
                    value={draft.permissions}
                    fullAccess={draft.fullAccess}
                    disabled={addM.isPending}
                    onFullAccess={(on) => setDraft({ ...draft, fullAccess: on })}
                    onToggle={(key, on) =>
                      setDraft({
                        ...draft,
                        permissions: on
                          ? [...draft.permissions, key]
                          : draft.permissions.filter((p) => p !== key),
                      })
                    }
                  />

                  <Button
                    className="w-full"
                    disabled={addM.isPending}
                    onClick={() => addM.mutate()}
                  >
                    {addM.isPending ? (
                      <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="ml-1 h-4 w-4" />
                    )}
                    إنشاء رابط الموظف
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center justify-center gap-2 p-4 text-sm font-semibold text-primary"
                >
                  <UserPlus className="h-4 w-4" />
                  إضافة موظف
                </button>
              )}
            </section>

            <section className="space-y-3">
              {q.isLoading && (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 p-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  جاري التحميل…
                </div>
              )}

              {!q.isLoading && members.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  لا يوجد موظفون بعد.
                </div>
              )}

              {members.map((member) => (
                <article
                  key={member.id}
                  className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {member.name || "بدون اسم"}
                        </span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                            (member.status === "active"
                              ? "bg-primary/10 text-primary"
                              : member.status === "invited"
                                ? "bg-accent text-accent-foreground"
                                : "bg-muted text-muted-foreground")
                          }
                        >
                          {STATUS_LABELS[member.status]}
                        </span>
                      </div>
                      <div dir="ltr" className="mt-1 truncate text-xs text-muted-foreground">
                        {member.email ?? "— لم يسجّل بعد —"}
                      </div>
                      <div className="mt-2 text-xs font-medium">
                        {permissionSummary(member)}
                      </div>
                      <InviteLink member={member} />
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Switch
                        checked={member.status === "active"}
                        disabled={statusM.isPending}
                        onCheckedChange={(v) =>
                          statusM.mutate({
                            id: member.id,
                            status: v ? "active" : "disabled",
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          editingId === member.id ? setEditingId(null) : startEdit(member)
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteM.isPending}
                        onClick={() => {
                          if (confirm(`حذف ${member.name || member.email} نهائيًا؟`)) {
                            deleteM.mutate(member.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                    <div>
                      <dt className="font-semibold">تاريخ الإضافة</dt>
                      <dd>{formatDate(member.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">آخر دخول</dt>
                      <dd>{formatDate(member.last_login_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">آخر تعديل</dt>
                      <dd>{formatDate(member.updated_at)}</dd>
                    </div>
                  </dl>

                  {editingId === member.id && (
                    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                      <Input
                        placeholder="اسم الموظف"
                        value={editDraft.name}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, name: e.target.value })
                        }
                      />
                      <PermissionPicker
                        value={editDraft.permissions}
                        fullAccess={editDraft.fullAccess}
                        disabled={saveM.isPending}
                        onFullAccess={(on) =>
                          setEditDraft({ ...editDraft, fullAccess: on })
                        }
                        onToggle={(key, on) =>
                          setEditDraft({
                            ...editDraft,
                            permissions: on
                              ? [...editDraft.permissions, key]
                              : editDraft.permissions.filter((p) => p !== key),
                          })
                        }
                      />
                      <Button
                        className="w-full"
                        disabled={saveM.isPending}
                        onClick={() => saveM.mutate(member.id)}
                      >
                        {saveM.isPending && (
                          <Loader2 className="ml-1 h-4 w-4 animate-spin" />
                        )}
                        حفظ الصلاحيات
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
