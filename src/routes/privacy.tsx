import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => legalHead("/privacy", "Privacy Policy", "How Kopi Malay collects, uses and protects customer, guest-order and towing request information."),
  component: () => (
    <LegalPage title="Privacy Policy">
      <p>Kopi Malay ("we", "us") respects your privacy. This policy explains what information we collect when you shop Route 1 merchandise or request Towing & Rescue, and how we keep it safe.</p>
      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Accounts:</strong> email address, and name when signing in with Google or email and password.</li>
        <li><strong>Profile details:</strong> name, phone, default delivery address, preferred contact method and motorcycle make, model and plate — only what you choose to save.</li>
        <li><strong>Guest checkout:</strong> name, phone, email and delivery address needed to fulfil your order.</li>
        <li><strong>Orders:</strong> items, prices, currency, shipping details, promo codes and the payment receipt you upload.</li>
        <li><strong>Towing requests:</strong> name, phone, motorcycle details, breakdown location and destination.</li>
        <li><strong>Wishlist:</strong> saved items, stored on your device as a guest or in your account as a member.</li>
      </ul>
      <h2>2. How we use it</h2>
      <p>We use your information only to process and verify orders, arrange delivery, respond to towing requests, provide customer support, and send member offers where you have registered. We do not sell your personal data.</p>
      <h2>3. Storage & protection</h2>
      <p>Data is stored on our secure cloud database with access controls so customers can only see their own records. Payment receipts are kept in private storage visible only to authorised staff. Order and towing alerts are sent to our team through a private messaging channel.</p>
      <h2>4. Sharing</h2>
      <p>We share delivery details with couriers (e.g. J&T Express) and towing partners only as needed to complete your request, or where required by law.</p>
      <h2>5. Retention</h2>
      <p>Order records are kept for accounting and warranty purposes. You may ask us to delete your account and profile at any time.</p>
      <h2>6. Your rights</h2>
      <p>You may access, correct or request deletion of your personal data by contacting us on WhatsApp at +66 97 009 8182 or via our social channels.</p>
    </LegalPage>
  ),
});
