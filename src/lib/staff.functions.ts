/**
 * Team (staff) management server functions.
 *
 * Listing / adding / editing / deleting staff is owner-only. `getCurrentActor`
 * is callable by anyone with a session so the dashboard can hide sections the
 * signed-in person is not allowed to open.
 *
 * Server-only modules are loaded with dynamic import() inside handlers so this
 * client-reachable module never bundles server-only code or secrets.
 */

import { createServerFn } from "@tanstack/react-start";

import {
  normalizePermissions,
  type CurrentActor,
  type StaffInviteInfo,
  type StaffListResult,
  type StaffMember,
} from "@/lib/staff-types";

function ensureEmail(value: unknown): string {
  const s = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) {
    throw new Error("البريد الإلكتروني غير صالح.");
  }
  return s;
}

function ensureName(value: unknown): string {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  if (s.length < 2) throw new Error("اكتب اسم الموظف.");
  if (s.length > 80) throw new Error("الاسم طويل جدًا.");
  return s;
}

function ensureToken(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f]{24,}$/i.test(s)) throw new Error("هذا الرابط غير صالح.");
  return s;
}

function ensureId(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f-]{16,}$/i.test(s)) throw new Error("الموظف غير موجود.");
  return s;
}

export const getCurrentActor = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentActor> => {
    const { requireActor } = await import("@/lib/session-guard.server");
    const actor = await requireActor();
    return {
      email: actor.email,
      name: actor.name,
      isOwner: actor.isOwner,
      full_access: actor.full_access,
      permissions: actor.permissions,
    };
  },
);

export const listStaffMembers = createServerFn({ method: "GET" }).handler(
  async (): Promise<StaffListResult> => {
    const { requireOwner } = await import("@/lib/session-guard.server");
    const owner = await requireOwner();
    const { listStaff } = await import("@/lib/staff.server");
    const members = await listStaff(owner.merchantId);
    return {
      members,
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
    };
  },
);

/**
 * Create a staff member as a pending INVITE. The owner never types the staff
 * email — the returned row carries a secret token that becomes the invite link,
 * and the staff member registers themself when they open it.
 */
export const addStaffMember = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { name: string; permissions: string[]; full_access?: boolean }) => ({
      name: ensureName(data?.name),
      permissions: normalizePermissions(data?.permissions),
      full_access: Boolean(data?.full_access),
    }),
  )
  .handler(async ({ data }): Promise<StaffMember> => {
    const { requireOwner } = await import("@/lib/session-guard.server");
    const owner = await requireOwner();
    if (!data.full_access && data.permissions.length === 0) {
      throw new Error("اختر صلاحية واحدة على الأقل.");
    }
    const { createStaffInvite } = await import("@/lib/staff.server");
    return createStaffInvite({
      merchantId: owner.merchantId,
      name: data.name,
      permissions: data.permissions,
      fullAccess: data.full_access,
    });
  });

/** Public: what the invite link shows before the staff member registers. */
export const getStaffInvite = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => ({ token: ensureToken(data?.token) }))
  .handler(async ({ data }): Promise<StaffInviteInfo> => {
    const { findStaffByToken } = await import("@/lib/staff.server");
    const found = await findStaffByToken(data.token);
    if (!found) throw new Error("هذا الرابط غير صالح أو تم حذفه.");
    if (found.member.status === "disabled") {
      throw new Error("تم إيقاف هذا الحساب. تواصل مع صاحب الحساب.");
    }
    return {
      name: found.member.name,
      full_access: found.member.full_access,
      permissions: found.member.permissions,
      status: found.member.status,
      email: found.member.email,
    };
  });

/**
 * Public: the staff member registers themself with the invite link, then gets a
 * session scoped to the owner's brand with their own permissions.
 */
export const acceptStaffInvite = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; email: string; name?: string }) => ({
    token: ensureToken(data?.token),
    email: ensureEmail(data?.email),
    name: data?.name === undefined || String(data.name).trim() === ""
      ? ""
      : ensureName(data.name),
  }))
  .handler(async ({ data }): Promise<{ ok: true; nextRoute: string; name: string }> => {
    const { findStaffByToken, acceptStaffInvite: accept, touchStaffLogin } =
      await import("@/lib/staff.server");
    const found = await findStaffByToken(data.token);
    if (!found) throw new Error("هذا الرابط غير صالح أو تم حذفه.");
    if (found.member.status === "disabled") {
      throw new Error("تم إيقاف هذا الحساب. تواصل مع صاحب الحساب.");
    }

    let member = found.member;
    if (member.status === "invited" || !member.email) {
      member = await accept({ staffId: member.id, email: data.email, name: data.name });
    } else {
      if (member.email !== data.email) {
        throw new Error("هذا الرابط مسجَّل ببريد آخر. استخدم نفس البريد.");
      }
      await touchStaffLogin(member.id);
    }

    const { updateSession } = await import("@tanstack/react-start/server");
    const { getSessionConfig } = await import("@/lib/session.server");
    await updateSession(getSessionConfig(), {
      userId: found.merchantId,
      email: member.email ?? data.email,
      staffId: member.id,
      actorEmail: member.email ?? data.email,
    });

    return { ok: true, nextRoute: "/dashboard", name: member.name };
  });

export const updateStaffMember = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      permissions?: string[];
      full_access?: boolean;
      status?: string;
    }) => ({
      id: ensureId(data?.id),
      name: data?.name === undefined ? undefined : ensureName(data.name),
      permissions:
        data?.permissions === undefined
          ? undefined
          : normalizePermissions(data.permissions),
      full_access: data?.full_access === undefined ? undefined : Boolean(data.full_access),
      status:
        data?.status === undefined
          ? undefined
          : data.status === "disabled"
            ? ("disabled" as const)
            : ("active" as const),
    }),
  )
  .handler(async ({ data }): Promise<StaffMember> => {
    const { requireOwner } = await import("@/lib/session-guard.server");
    const owner = await requireOwner();
    if (
      data.full_access === false &&
      data.permissions !== undefined &&
      data.permissions.length === 0
    ) {
      throw new Error("اختر صلاحية واحدة على الأقل.");
    }
    const { updateStaff } = await import("@/lib/staff.server");
    return updateStaff({
      merchantId: owner.merchantId,
      staffId: data.id,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
      ...(data.full_access !== undefined ? { fullAccess: data.full_access } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    });
  });

export const removeStaffMember = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => ({ id: ensureId(data?.id) }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireOwner } = await import("@/lib/session-guard.server");
    const owner = await requireOwner();
    const { deleteStaff } = await import("@/lib/staff.server");
    await deleteStaff(owner.merchantId, data.id);
    return { ok: true };
  });
