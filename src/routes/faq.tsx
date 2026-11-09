import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/legal-page";

const faqs: { q: string; a: React.ReactNode }[] = [
  { q: "How do I order riding gear and merchandise?", a: <>Browse the Shop menu, choose a size for apparel, then Add to Cart or Buy Now. At checkout, pick Malaysia or Thailand, fill in your details and pay by QR. You can order as a guest or sign in as a member.</> },
  { q: "Do you ship to Malaysia and Thailand?", a: <>Yes. We ship from Tak, Thailand. Thailand shipping is free for most items; Malaysia uses quantity-block rates, and Sabah & Sarawak add RM 10 per order. See <Link to="/shipping-returns" className="underline">Shipping & Returns</Link>. We do not ship to Singapore.</> },
  { q: "How does QR payment and receipt upload work?", a: <>Checkout shows the QR for your country — DuitNow / Touch 'n Go for Malaysia or PromptPay for Thailand. Scan and pay the exact total, then upload a screenshot or PDF of your receipt (PNG, JPG or PDF, max 5MB). Your order becomes "Pending Verification" until we confirm the payment.</> },
  { q: "How do sticker bundles work?", a: <>8×8cm paper stickers are bundled automatically: in Malaysia, every 3 stickers cost RM 18 (otherwise RM 6.50 each); in Thailand, every 3 cost THB 140 (otherwise THB 49 each). Mix any designs. Chromium stickers are not included.</> },
  { q: "How do I request Towing & Rescue?", a: <>Open Services → <Link to="/towing" className="underline">Towing & Rescue</Link>, enter your name, phone, motorcycle details, breakdown area and destination, then submit. Our team is alerted immediately and will call you. Members with a saved profile get details filled in automatically.</> },
  { q: "How can I track my order?", a: <>Once shipped, we add your courier tracking number to the order. Contact us on WhatsApp with your order reference anytime.</> },
];

export const Route = createFileRoute("/faq")({
  head: () => legalHead("/faq", "FAQ", "Answers about ordering, shipping to Malaysia and Thailand, QR payments, sticker bundles and Towing & Rescue."),
  component: () => (
    <LegalPage title="Frequently Asked Questions">
      <div className="divide-y divide-border border-y border-border">
        {faqs.map((f) => (
          <details key={f.q} className="group py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-foreground">
              {f.q}
              <span className="text-xl transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="mt-3 text-foreground/80">{f.a}</p>
          </details>
        ))}
      </div>
    </LegalPage>
  ),
});
