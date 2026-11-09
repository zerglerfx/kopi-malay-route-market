import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/legal-page";

export const Route = createFileRoute("/shipping-returns")({
  head: () => legalHead("/shipping-returns", "Shipping & Returns", "Shipping rates from Tak to Malaysia and Thailand, tumbler weight fees, East Malaysia surcharge and returns."),
  component: () => (
    <LegalPage title="Shipping & Returns">
      <p>All orders are packed and dispatched from Tak, Thailand. We currently deliver to Malaysia and Thailand only; Singapore customers may arrange collection through a contact in Peninsular Malaysia.</p>
      <h2>Thailand</h2>
      <ul>
        <li>Accessories, stickers, patches, magnets and apparel ship free.</li>
        <li>Tumblers weigh 292g each. THB 60 applies for the first kilogram of tumbler weight, plus THB 60 for every additional kilogram started.</li>
      </ul>
      <h2>Peninsular Malaysia</h2>
      <ul>
        <li>Jerseys & T-shirts: RM 20 for every block of 2 shirts.</li>
        <li>Tumblers: RM 20 for every block of 2 tumblers.</li>
        <li>Accessories (stickers, magnets, patches, lanyards, other merch): RM 20 for every block of 20 units.</li>
      </ul>
      <h2>Sabah & Sarawak</h2>
      <p>The Peninsular Malaysia rate applies, plus a flat RM 10 surcharge once per order.</p>
      <h2>Processing & tracking</h2>
      <p>Orders ship after payment verification, usually within 1–3 working days. You will receive a courier tracking number once dispatched. Cross-border delivery typically takes 5–10 working days.</p>
      <h2>Returns & exchanges</h2>
      <ul>
        <li>Contact us on WhatsApp (+66 97 009 8182) within 7 days of delivery with your order reference.</li>
        <li>Items must be unused, unwashed and in original packaging.</li>
        <li>Size exchanges are subject to stock; the customer covers return shipping unless the item was faulty or incorrect.</li>
        <li>Return address: Kopi Malay, 3, 13 Chomphon, Tambon Rahaeng, Mueang Tak District, Tak 63000, Thailand.</li>
      </ul>
    </LegalPage>
  ),
});
