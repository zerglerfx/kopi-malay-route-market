import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getOwnerPinStatus, requestOwnerPinCode, setOwnerPin, testOwnerPin } from "@/lib/owner.functions";
import { isValidCode, isValidPin } from "@/lib/owner-pin";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function OwnerPinButton() {
  const statusFn = useServerFn(getOwnerPinStatus);
  const { data } = useQuery({ queryKey: ["owner-pin-status"], queryFn: () => statusFn() });
  const [open, setOpen] = useState(false);
  if (!data?.isOwner) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="mr-1 h-4 w-4" /> Owner PIN {data.hasPin ? "· set" : "· not set"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">{open && <PinFlow status={data} />}</DialogContent>
      </Dialog>
    </>
  );
}

function PinFlow({ status }: { status: { hasPin: boolean; lockedUntil: string | null; email: string } }) {
  const qc = useQueryClient();
  const sendFn = useServerFn(requestOwnerPinCode);
  const setFn = useServerFn(setOwnerPin);
  const testFn = useServerFn(testOwnerPin);
  const [step, setStep] = useState<"start" | "code" | "done">("start");
  const [sentTo, setSentTo] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [testPin, setTestPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["owner-pin-status"] });

  const send = async () => {
    setBusy(true); setErr(null);
    try { const r = await sendFn(); if (r.ok) { setSentTo(r.sentTo); setStep("code"); setCode(""); } else setErr(r.error); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not send code"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setErr(null);
    if (!isValidCode(code)) return setErr("Enter the 6-digit code from your email.");
    if (!isValidPin(pin)) return setErr("PIN must be exactly 6 digits.");
    if (pin !== pin2) return setErr("The two PINs do not match.");
    setBusy(true);
    try { const r = await setFn({ data: { code, pin } }); if (r.ok) { setStep("done"); toast.success("Owner PIN saved"); void refresh(); } else setErr(r.error); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not save PIN"); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await testFn({ data: { pin: testPin } });
      if (r.ok) toast.success("PIN is correct");
      else setErr(r.reason === "locked" ? `PIN locked after 5 wrong tries. Try again after ${r.lockedUntil ? time(r.lockedUntil) : "15 minutes"}.` : r.reason === "not_set" ? "No PIN set yet." : "Wrong PIN.");
      setTestPin(""); void refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Owner PIN</DialogTitle>
        <DialogDescription>Your 6-digit PIN is needed for refunds and undoing verified orders. Status: <b>{status.hasPin ? "set" : "not set"}</b>{status.lockedUntil && <> · locked until {time(status.lockedUntil)}</>}</DialogDescription>
      </DialogHeader>
      {step === "start" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">We will email a one-time code to {status.email}. The code works once and expires in 10 minutes.</p>
          <Button onClick={send} disabled={busy} className="w-full">{busy ? "Sending…" : status.hasPin ? "Send code to change PIN" : "Send code to set PIN"}</Button>
          {status.hasPin && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-semibold">Check your PIN</p>
              <div className="flex gap-2">
                <Input inputMode="numeric" type="password" placeholder="••••••" value={testPin} onChange={(e) => setTestPin(digits(e.target.value))} />
                <Button variant="outline" onClick={test} disabled={busy || testPin.length !== 6}>Check</Button>
              </div>
            </div>
          )}
        </div>
      )}
      {step === "code" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Code sent to {sentTo}. Check your inbox (and spam folder).</p>
          <label className="block text-sm">Email code<Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(digits(e.target.value))} placeholder="123456" /></label>
          <label className="block text-sm">New 6-digit PIN<Input inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(digits(e.target.value))} /></label>
          <label className="block text-sm">Confirm PIN<Input inputMode="numeric" type="password" value={pin2} onChange={(e) => setPin2(digits(e.target.value))} /></label>
          <Button onClick={save} disabled={busy} className="w-full">{busy ? "Saving…" : "Save PIN"}</Button>
          <button type="button" className="text-xs underline text-muted-foreground" onClick={send} disabled={busy}>Send a new code</button>
        </div>
      )}
      {step === "done" && <p className="text-sm">Your Owner PIN is saved. A security alert was sent to Telegram.</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
    </>
  );
}
