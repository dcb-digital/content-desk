"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

async function getWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .single();
  if (!membership) throw new Error("No workspace");

  return { supabase, user, membership };
}

export async function inviteMember(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const role = (formData.get("role") as string) ?? "member";

  if (!email || !z.string().email().safeParse(email).success) {
    return { error: "Valid email required" };
  }
  if (role !== "admin" && role !== "member") {
    return { error: "Invalid role" };
  }

  const { supabase, membership } = await getWorkspace();
  if (membership.role !== "admin") return { error: "Only admins can invite members" };

  const admin = createAdminClient();

  // Check if the user already exists in Supabase auth
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = existing?.users.find(
    (u) => u.email?.toLowerCase() === email
  );

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    // Ensure they have a public.users row
    await supabase
      .from("users")
      .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
  } else {
    // Send invite email — creates an auth.users row with a confirmation link
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { invited_to_workspace: membership.workspace_id },
    });
    if (error || !data.user) return { error: error?.message ?? "Invite failed" };
    userId = data.user.id;
    // Mirror into public.users (trigger will also do this on email confirm, but pre-create for the membership)
    await supabase
      .from("users")
      .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
  }

  // Add membership (ignore if already exists)
  const { error: memErr } = await supabase
    .from("memberships")
    .upsert(
      { workspace_id: membership.workspace_id, user_id: userId, role },
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
    );

  if (memErr) return { error: memErr.message };

  revalidatePath("/settings/team");
  return { success: true };
}

export async function removeMember(userId: string) {
  const { supabase, user, membership } = await getWorkspace();
  if (membership.role !== "admin") return { error: "Only admins can remove members" };
  if (userId === user.id) return { error: "Cannot remove yourself" };

  await supabase
    .from("memberships")
    .delete()
    .eq("workspace_id", membership.workspace_id)
    .eq("user_id", userId);

  revalidatePath("/settings/team");
}

export async function updateMemberRole(userId: string, role: "admin" | "member") {
  const { supabase, user, membership } = await getWorkspace();
  if (membership.role !== "admin") return { error: "Only admins can change roles" };
  if (userId === user.id) return { error: "Cannot change your own role" };

  await supabase
    .from("memberships")
    .update({ role })
    .eq("workspace_id", membership.workspace_id)
    .eq("user_id", userId);

  revalidatePath("/settings/team");
}
