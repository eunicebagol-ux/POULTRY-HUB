import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POULTRY HUB — Clerk Webhook Profile Provisioning Endpoint
 *
 * Handles real-time Clerk user lifecycle events:
 * - user.created -> Provisions a public.profiles row. Unsolicited sign-ups default to is_active = false
 *                   (quarantined until admin approval) to prevent unauthorized staff access.
 * - user.updated -> Synchronizes full_name and avatar_url without modifying role or active status.
 * - user.deleted -> Soft deactivates profile (is_active = false) to preserve ledgers & audit trails.
 *
 * Idempotence: Handled safely via database lookups and ON CONFLICT (id).
 * Security: Uses SUPABASE_SERVICE_ROLE_KEY exclusively inside this server-side endpoint.
 * RBAC: Preserves existing roles on replay; quarantines new accounts until explicitly activated.
 */

export async function POST(req: NextRequest) {
  let evt;
  const signingSecret =
    process.env.CLERK_WEBHOOK_SIGNING_SECRET ||
    process.env.CLERK_WEBHOOK_SECRET;

  try {
    evt = await verifyWebhook(req, {
      signingSecret: signingSecret || undefined,
    });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response(
      "Webhook verification failed. Verify that CLERK_WEBHOOK_SIGNING_SECRET is set correctly.",
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("Supabase service-role client error in webhook:", err);
    return new Response(
      "Database configuration error: SUPABASE_SERVICE_ROLE_KEY is missing or invalid.",
      { status: 500 }
    );
  }

  if (evt.type === "user.created") {
    const { id, first_name, last_name, email_addresses, image_url } = evt.data;
    const primaryEmail = email_addresses?.[0]?.email_address;
    // Never store an email address as a person's name
    const fullName =
      [first_name, last_name].filter(Boolean).join(" ").trim() ||
      "Customer";

    // Check if profile already exists to prevent accidental demotion if event is replayed
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", id)
      .maybeSingle();

    // Preserve existing role and active status if profile already exists (e.g. webhook replay or re-registration).
    // Brand new sign-ups default to CUSTOMER role and is_active = false (pending ADMIN approval).
    const assignedRole = existingProfile?.role || "CUSTOMER";
    const isActive = existingProfile ? existingProfile.is_active : false;

    const { error } = await supabase.from("profiles").upsert(
      {
        id,
        role: assignedRole,
        full_name: fullName,
        avatar_url: image_url || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      if (error.code === "22P02" || error.message?.includes("user_role")) {
        console.warn(
          "Database schema warning: public.user_role enum does not contain CUSTOMER (Migration 012 pending)."
        );
      } else {
        console.error("Error creating profile from Clerk webhook:", error.message || error.code || error);
        return new Response("Database profile provisioning failed", { status: 500 });
      }
    }

    // Auto-link or provision customer entity record for CUSTOMER accounts
    if (assignedRole === "CUSTOMER" && primaryEmail) {
      try {
        const normalizedEmail = primaryEmail.toLowerCase().trim();
        const { data: matchingCusts } = await supabase
          .from("customers")
          .select("id, clerk_user_id")
          .eq("email", normalizedEmail);

        const unlinkedCusts = (matchingCusts ?? []).filter((c) => !c.clerk_user_id);

        if (unlinkedCusts.length === 1) {
          // Link existing unlinked customer record to this Clerk identity
          await supabase
            .from("customers")
            .update({
              clerk_user_id: id,
              is_active: isActive,
              updated_at: new Date().toISOString(),
            })
            .eq("id", unlinkedCusts[0].id);
        } else if (!matchingCusts || matchingCusts.length === 0) {
          // Provision new customer record in pending state (is_active = false)
          await supabase.from("customers").insert({
            name: fullName,
            email: normalizedEmail,
            clerk_user_id: id,
            is_active: false,
          });
        }
      } catch (custErr) {
        console.warn("Could not auto-link customer record:", custErr);
      }
    }
  }

  if (evt.type === "user.updated") {
    const { id, first_name, last_name, image_url } = evt.data;
    // Never store an email address as a person's name
    const clerkFullName =
      [first_name, last_name].filter(Boolean).join(" ").trim();

    // Check existing profile state
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("role, is_active, full_name")
      .eq("id", id)
      .maybeSingle();

    // If profile does not exist yet (e.g. event out of order),
    // provision with default CUSTOMER role to prevent unauthorized privilege escalation.
    // Preserves existing role and active status if profile already exists.
    const { error } = await supabase.from("profiles").upsert(
      {
        id,
        role: existingProfile?.role || "CUSTOMER",
        full_name: clerkFullName || existingProfile?.full_name || "Customer",
        avatar_url: image_url || null,
        is_active: existingProfile ? existingProfile.is_active : false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      if (error.code === "22P02" || error.message?.includes("user_role")) {
        console.warn(
          "Database schema warning: public.user_role enum does not contain CUSTOMER (Migration 012 pending)."
        );
      } else {
        console.error("Error updating profile from Clerk webhook:", error.message || error.code || error);
        return new Response("Database profile update failed", { status: 500 });
      }
    }
  }

  if (evt.type === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      // Soft deactivate: preserve historical audit & transaction ledgers
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        console.error("Error deactivating profile from Clerk webhook:", error);
        return new Response("Database profile deactivation failed", { status: 500 });
      }
    }
  }

  return NextResponse.json({ message: "Webhook processed successfully" }, { status: 200 });
}
