import { Link } from "@tanstack/react-router";

const WHATSAPP_URL = "https://wa.me/66970098182";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1c-1.5 0-2.9-.4-4-1.2v6.1c0 3.3-2.6 5.7-5.8 5.7S5 18.1 5 15c0-3.3 2.9-5.8 6.3-5.3v3.2c-1.6-.4-3.1.7-3.1 2.2 0 1.3 1.1 2.4 2.5 2.4 1.5 0 2.6-1 2.6-2.8V3h3.3z" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.7-.3-1.5-.7-2.2-1.4-.6-.5-1-1.2-1.2-1.6-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.2-.3-.3-.6-.4z" />
    </svg>
  );
}

const legal = [
  { to: "/privacy", label: "Privacy Policy" },
  { to: "/accessibility", label: "Accessibility Statement" },
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/refund-policy", label: "Refund Policy" },
  { to: "/shipping-returns", label: "Shipping & Returns" },
  { to: "/faq", label: "FAQ" },
] as const;

const socials = [
  { href: "https://www.facebook.com/kopimalay22/", label: "Facebook", Icon: FacebookIcon },
  { href: "https://www.instagram.com/kopimalay", label: "Instagram", Icon: InstagramIcon },
  { href: "https://www.tiktok.com/@kopi.malay", label: "TikTok", Icon: TikTokIcon },
];

const heading = "mb-4 font-display text-xs font-bold uppercase tracking-[0.2em] text-ink-foreground";
const iconBtn =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-foreground/30 text-ink-foreground transition-colors hover:bg-ink-foreground hover:text-ink";

export function SiteFooter() {
  return (
    <footer className="no-print bg-ink text-ink-foreground">
      <div className="road-stripe" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 text-sm text-ink-foreground/70 md:grid-cols-3">
        <nav aria-label="Legal">
          <h2 className={heading}>Legal</h2>
          <ul className="space-y-2">
            {legal.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="hover:text-ink-foreground hover:underline">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className={heading}>Social</h2>
          <div className="flex gap-3">
            {socials.map(({ href, label, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Kopi Malay on ${label}`} className={iconBtn}>
                <Icon />
              </a>
            ))}
          </div>
        </div>
        <address className="not-italic">
          <h2 className={heading}>Contact</h2>
          <p className="font-semibold text-ink-foreground">Kopi Malay</p>
          <p className="mt-1">3, 13 Chomphon, Tambon Rahaeng,<br />Mueang Tak District, Tak 63000</p>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Chat with Kopi Malay on WhatsApp" className="mt-4 inline-flex items-center gap-3 hover:text-ink-foreground">
            <span className={iconBtn}><WhatsAppIcon /></span>
            <span>+66 97 009 8182</span>
          </a>
        </address>
      </div>
      <div className="border-t border-ink-foreground/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-ink-foreground/50">
          © {new Date().getFullYear()} Kopi Malay. Ride safe, drink good kopi.
        </p>
      </div>
    </footer>
  );
}
