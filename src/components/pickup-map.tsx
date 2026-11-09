import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };
// Minimal typing for the Maps JS API we use.
type GMap = { panTo: (p: LatLng) => void; setZoom: (z: number) => void; addListener: (e: string, cb: (ev: { latLng: { lat: () => number; lng: () => number } }) => void) => void };
type GMarker = { setPosition: (p: LatLng) => void; addListener: GMap["addListener"]; getPosition: () => { lat: () => number; lng: () => number } };
type Maps = { Map: new (el: HTMLElement, o: object) => GMap; Marker: new (o: object) => GMarker };

let loading: Promise<Maps> | null = null;
function loadMaps(): Promise<Maps> {
  const w = window as unknown as { google?: { maps: Maps }; __kmMapsReady?: () => void };
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    w.__kmMapsReady = () => resolve(w.google!.maps);
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__kmMapsReady&channel=${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Map failed to load"));
    document.head.appendChild(s);
  });
  return loading;
}

const DEFAULT: LatLng = { lat: 16.8839, lng: 99.1258 }; // Tak, Thailand

export function PickupMap({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const marker = useRef<GMarker | null>(null);
  const map = useRef<GMap | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let off = false;
    loadMaps().then((maps) => {
      if (off || !el.current) return;
      const start = value ?? DEFAULT;
      map.current = new maps.Map(el.current, { center: start, zoom: value ? 15 : 9, clickableIcons: false, streetViewControl: false, mapTypeControl: false });
      marker.current = new maps.Marker({ position: start, map: map.current, draggable: true });
      map.current.addListener("click", (e) => { const p = { lat: e.latLng.lat(), lng: e.latLng.lng() }; marker.current?.setPosition(p); cb.current(p); });
      marker.current.addListener("dragend", () => { const p = marker.current!.getPosition(); cb.current({ lat: p.lat(), lng: p.lng() }); });
    }).catch((e) => console.error(e));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && marker.current && map.current) { marker.current.setPosition(value); map.current.panTo(value); }
  }, [value]);

  return <div ref={el} className="h-80 w-full overflow-hidden rounded-md border bg-muted" role="application" aria-label="Map — tap to set your pick-up point" />;
}
