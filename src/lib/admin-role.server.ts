// Owner-only admin grant/removal with confirmed-email check, audited write, and best-effort alert.
export type AdminRoleDeps = {
  assertOwner: () => Promise<void>;
  getTarget: (id: string) => Promise<{ email: string; email_confirmed: boolean; is_owner: boolean } | null>;
  write: (grant: boolean) => Promise<boolean>; // role change + audit row in one SQL transaction
  notify: (text: string) => Promise<unknown>;
};

export async function runSetAdminRole(input: { actorId: string; actorEmail: string; targetId: string; grant: boolean }, deps: AdminRoleDeps) {
  await deps.assertOwner();
  if (!input.grant && input.targetId === input.actorId) throw new Error("You can't remove your own admin access");
  const target = await deps.getTarget(input.targetId);
  if (!target) throw new Error("Account not found");
  if (target.is_owner) throw new Error("Owner accounts can't be changed here");
  if (input.grant && !target.email_confirmed) throw new Error("Staff access can only be given to accounts with a confirmed email");
  const changed = await deps.write(input.grant);
  if (changed) {
    try {
      await deps.notify(`🔐 <b>Staff access ${input.grant ? "granted" : "removed"}</b>\n• Account: ${target.email}\n• By owner: ${input.actorEmail}\n• Time: ${new Date().toISOString()}`);
    } catch (e) { console.error("[admin-role] Telegram alert failed", e); }
  }
  return { ok: true, changed };
}
