/**
 * Early-access waitlist (first 100 subscribers).
 *
 * The counter is the real row count of `waitlist_signups` — no cached or
 * fake numbers. Joining requires nothing but an email address; there is no
 * confirmation step.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const WAITLIST_LIMIT = 100;

export interface WaitlistStats {
  /** Real number of stored signups. */
  count: number;
  /** Total early-access seats. */
  limit: number;
}

export interface JoinWaitlistResult {
  /** 1-based place in line for this email. */
  position: number;
  /** True when this email was already on the list. */
  already: boolean;
  count: number;
  limit: number;
}

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(5, { message: "البريد الإلكتروني غير صحيح." })
    .max(255, { message: "البريد الإلكتروني طويل جدًا." })
    .email({ message: "البريد الإلكتروني غير صحيح." }),
});

export const getWaitlistStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<WaitlistStats> => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await getSupabaseAdmin()
      .from("waitlist_signups")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return { count: count ?? 0, limit: WAITLIST_LIMIT };
  },
);

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => emailSchema.parse(data))
  .handler(async ({ data }): Promise<JoinWaitlistResult> => {
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = getSupabaseAdmin();

    // Already on the list? Return the original place in line.
    const existing = await admin
      .from("waitlist_signups")
      .select("created_at")
      .ilike("email", data.email)
      .maybeSingle();

    let createdAt = (existing.data as { created_at?: string } | null)?.created_at ?? null;
    const already = Boolean(createdAt);

    if (!createdAt) {
      const inserted = await admin
        .from("waitlist_signups")
        .insert({ email: data.email })
        .select("created_at")
        .single();
      if (inserted.error) throw inserted.error;
      createdAt = (inserted.data as { created_at: string }).created_at;
    }

    const [{ count: before }, { count: total }] = await Promise.all([
      admin
        .from("waitlist_signups")
        .select("id", { count: "exact", head: true })
        .lte("created_at", createdAt),
      admin.from("waitlist_signups").select("id", { count: "exact", head: true }),
    ]);

    return {
      position: before ?? 1,
      already,
      count: total ?? 0,
      limit: WAITLIST_LIMIT,
    };
  });
