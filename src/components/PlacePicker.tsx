import { useEffect, useState, type InputHTMLAttributes } from "react";
import { rankPlaces, bestPlace } from "@/lib/place-match";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  options: readonly string[];
  onValueChange: (v: string) => void;
};

/** Type-to-search state/province picker; snaps to the closest spelling when the field is left. */
export function PlacePicker({ value, options, onValueChange, onBlur, className, id, ...rest }: Props) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => { setText(value); }, [value]);
  const matches = rankPlaces(text === value ? "" : text, options);
  const choose = (v: string) => { setText(v); onValueChange(v); setOpen(false); };
  const listId = `${id}-list`;
  return (
    <div className="relative">
      <input
        {...rest}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        className={className}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); choose(matches[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        onBlur={(e) => {
          setOpen(false);
          const v = text.trim() ? bestPlace(text, options) : "";
          setText(v); onValueChange(v);
          onBlur?.(e);
        }}
      />
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-md">
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(m); }}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-accent text-accent-foreground" : ""}`}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
