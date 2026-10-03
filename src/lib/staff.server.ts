/**
 * Server-only helpers for the `staff_members` table.
 *
 * MUST NOT be imported from client/browser code. Every operation uses the
 * service-role client and is only safe to call from trusted server handlers
 * that have already established who the caller is.
 */

import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import {
  normalizePermissions,
  type StaffMember,
  type StaffPermission,
  type StaffStatus,
} from "@/lib/staff-types";

const TABLE = "staff_members";

interface StaffRow {
  id: string;
  merchant_id: string;
  invite_token: string;
  email: string | null;
  name: string | null;
  permissions: string[] | null;
  full_access: boolean | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  last_login_at: string | null;
}

function mapRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    email: row.email ?? null,
    invite_token: row.invite_token,
    name: row.name ?? "",
    permissions: normalizePermissions(row.permissions),
    full_access: Boolean(row.full_access),
    status:
      row.status === "disabled"
        ? "disabled"
        : row.status === "invited"
          ? "invited"
          : "active",
    created_at: row.created_at,
    updated_at: row.updated_at,
    accepted_at: row.accepted_at,
    last_login_at: row.last_login_at,
  };
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Look up a staff member by email, across all merchants. */
export async function findStaffByEmail(email: string): Promise<{
  merchantId: string;
  member: StaffMember;
} | null> {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("email", clean)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as StaffRow;
  return { merchantId: row.merchant_id, member: mapRow(row) };
}

export async function getStaffById(
  merchantId: string,
  staffId: string,
): Promise<StaffMember | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("id", staffId)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as StaffRow);
}

export async function listStaff(merchantId: string): Promise<StaffMember[]> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as StaffRow[]).map(mapRow);
}

function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a pending invite. No email is asked from the owner — the staff member
 * registers themself through the generated link.
 */
export async function createStaffInvite(input: {
  merchantId: string;
  name: string;
  permissions: StaffPermission[];
  fullAccess: boolean;
}): Promise<StaffMember> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      merchant_id: input.merchantId,
      invite_token: newToken(),
      email: null,
      name: input.name.trim(),
      permissions: input.fullAccess ? [] : input.permissions,
      full_access: input.fullAccess,
      status: "invited",
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("تعذّر إنشاء رابط الموظف.");
  return mapRow(data as StaffRow);
}

/** Look up a staff row by the secret token carried in the invite link. */
export async function findStaffByToken(token: string): Promise<{
  merchantId: string;
  member: StaffMember;
} | null> {
  const clean = String(token ?? "").trim();
  if (clean.length < 16) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from(TABLE)
    .select("*")
    .eq("invite_token", clean)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as StaffRow;
  return { merchantId: row.merchant_id, member: mapRow(row) };
}

/**
 * The staff member registers themself: store the email/name they signed up
 * with and activate the row. Re-opening the link later is a normal sign-in.
 */
export async function acceptStaffInvite(input: {
  staffId: string;
  email: string;
  name: string;
}): Promise<StaffMember> {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    email: normalizeEmail(input.email),
    status: "active",
    accepted_at: now,
    updated_at: now,
    last_login_at: now,
  };
  const name = input.name.trim();
  if (name) patch["name"] = name;
  const { data, error } = await admin
    .from(TABLE)
    .update(patch)
    .eq("id", input.staffId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    if (error?.code === "23505" || /duplicate|unique/i.test(error?.message ?? "")) {
      throw new Error("هذا البريد مُستخدم بالفعل لموظف آخر.");
    }
    throw new Error("تعذّر إكمال التسجيل.");
  }
  return mapRow(data as StaffRow);
}

export async function updateStaff(input: {
  merchantId: string;
  staffId: string;
  name?: string;
  permissions?: StaffPermission[];
  fullAccess?: boolean;
  status?: StaffStatus;
}): Promise<StaffMember> {
  const admin = getSupabaseAdmin();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch["name"] = input.name.trim();
  if (input.fullAccess !== undefined) patch["full_access"] = input.fullAccess;
  if (input.permissions !== undefined) {
    patch["permissions"] = input.fullAccess ? [] : input.permissions;
  }
  if (input.status !== undefined) patch["status"] = input.status;

  const { data, error } = await admin
    .from(TABLE)
    .update(patch)
    .eq("id", input.staffId)
    .eq("merchant_id", input.merchantId)
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error("تعذّر تحديث صلاحيات الموظف.");
  return mapRow(data as StaffRow);
}

export async function deleteStaff(merchantId: string, staffId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from(TABLE)
    .delete()
    .eq("id", staffId)
    .eq("merchant_id", merchantId);
  if (error) throw new Error("تعذّر حذف الموظف.");
}

export async function touchStaffLogin(staffId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin
    .from(TABLE)
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", staffId);
}
