import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { LocateFixed } from "lucide-react";
import { towingErrors, type TowingInput } from "@/lib/towing";
import { submitTowingRequest } from "@/lib/towing.functions";

const PickupMap = lazy(() => import("@/components/pickup-map").then((m) => ({ default: m.PickupMap })));

export const Route = createFileRoute("/towing")({
  head: () => ({
    meta: [
      { title: "Towing & Rescue — Kopi Malay Route 1" },
      { name: "description", content: "Broken down on Route 1? Request motorcycle towing and rescue with your exact pick-up location pinned on the map." },
      { property: "og:title", content: "Motorcycle Towing & Rescue — Route 1" },
      { property: "og:description", content: "Stranded rider? Pin your location and request a tow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TowingPage,
});

type Text = Omit<TowingInput, "pickup_lat" | "pickup_lng">;
const FIELDS: { key: keyof Text; label: string; placeholder: string; textarea?: boolean; type?: string }[] = [
  { key: "name", label: "Your name", placeholder: "Ahmad bin Ali" },
  { key: "phone", label: "Phone number", placeholder: "+60 12-345 6789", type: "tel" },
  { key: "plate_number", label: "Motorcycle plate number", placeholder: "WXY 1234" },
  { key: "motorcycle_model", label: "Motorcycle model", placeholder: "Honda CB500X" },
  { key: "breakdown_location", label: "Current location / distance", placeholder: "Route 1090, near KM 45 towards Umphang", textarea: true },
  { key: "destination", label: "Towing destination address", placeholder: "Workshop / hotel address", textarea: true },
];
const field = "w-full rounded-md border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring";

function TowingPage() {
  const submit = useServerFn(submitTowingRequest);
  const [form, setForm] = useState<Text>({ name: "", phone: "", plate_number: "", motorcycle_model: "", breakdown_location: "", destination: "" });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) { toast.error("Location isn't available on this device."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPin({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Couldn't get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, pickup_lat: pin?.lat ?? null, pickup_lng: pin?.lng ?? null };
    const errs = towingErrors(payload);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) { document.getElementById(`tow-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      const r = await submit({ data: payload });
      setDone(r.reference);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold uppercase">Request received</h1>
      <p className="mt-3 text-muted-foreground">Our team has been alerted and will call you shortly. Keep your phone nearby and stay safe.</p>
      <p className="mt-6 inline-block rounded-md border px-4 py-2 font-display text-xl font-bold">{done}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold uppercase md:text-4xl">Towing &amp; Rescue</h1>
      <p className="mt-2 text-muted-foreground">Broken down? Fill in the details and pin your pick-up point. All fields are required.</p>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.textarea ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
              <label htmlFor={`tow-${f.key}`} className="text-sm font-medium">{f.label} *</label>
              {f.textarea ? (
                <textarea id={`tow-${f.key}`} rows={2} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-invalid={!!errors[f.key]} className={`${field} ${errors[f.key] ? "border-destructive" : ""}`} />
              ) : (
                <input id={`tow-${f.key}`} type={f.type ?? "text"} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-invalid={!!errors[f.key]} className={`${field} ${errors[f.key] ? "border-destructive" : ""}`} />
              )}
              {errors[f.key] && <p className="text-sm text-destructive">{errors[f.key]}</p>}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Pick-up point on map</p>
            <button type="button" onClick={locate} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"><LocateFixed className="size-4" /> Use my location</button>
          </div>
          <ClientOnly fallback={<div className="h-80 rounded-md border bg-muted" />}>
            <Suspense fallback={<div className="h-80 rounded-md border bg-muted" />}>
              <PickupMap value={pin} onChange={setPin} />
            </Suspense>
          </ClientOnly>
          <p className="text-xs text-muted-foreground">{pin ? `Pinned: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "Tap the map or drag the pin to your exact location."}</p>
        </div>
        <button disabled={busy} className="w-full rounded-md bg-primary py-3 font-display font-semibold uppercase text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Sending…" : "Request towing"}</button>
      </form>
    </div>
  );
}
