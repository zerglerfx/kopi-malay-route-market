type RoleRpc = { supabase?: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" | "owner" }) => PromiseLike<{ data: boolean | null }> }; userId?: string };
/** Re-check on every call that the caller is both admin and owner. Staff admins and customers are rejected. */
export async function assertOwnerCaller(ctx: RoleRpc): Promise<void> {
  if (!ctx?.supabase?.rpc || !ctx.userId) throw new Error("Please sign in again");
  const [{ data: a }, { data: o }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "owner" }),
  ]);
  if (!a || !o) throw new Error("Forbidden: owner access required");
}
