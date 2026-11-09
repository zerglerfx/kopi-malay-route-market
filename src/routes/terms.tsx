import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => legalHead("/terms", "Terms & Conditions", "Terms for shopping Kopi Malay Route 1 merchandise, accounts, guest orders, pricing and services."),
  component: () => (
    <LegalPage title="Terms & Conditions">
      <p>By using kopimalay.shop you agree to these terms. Please read them before placing an order or submitting a service request.</p>
      <h2>1. Accounts</h2>
      <p>You may register with Google or with an email and password. Keep your login details secure; you are responsible for activity on your account. Information you provide must be accurate.</p>
      <h2>2. Guest orders</h2>
      <p>You can order without an account. You must provide a valid name, phone, email and delivery address so we can verify payment and deliver.</p>
      <h2>3. Products</h2>
      <p>We describe our merchandise as accurately as possible. Colours may vary slightly by screen, and apparel sizes follow our size guide. Stock levels are shown live but may change before an order is verified.</p>
      <h2>4. Pricing & payment</h2>
      <ul>
        <li>Prices are shown in Malaysian Ringgit (RM) for Malaysia and Thai Baht (THB) for Thailand, based on the destination you select.</li>
        <li>Bundle offers and promo codes are calculated at checkout and may be withdrawn at any time.</li>
        <li>Payment is made by manual QR transfer (DuitNow / Touch 'n Go or PromptPay). An order is confirmed only after we verify your uploaded receipt.</li>
      </ul>
      <h2>5. Towing & Rescue</h2>
      <p>Towing requests are subject to partner availability, location and conditions. Response times are estimates and not guaranteed. In a medical emergency, contact local emergency services first.</p>
      <h2>6. Intellectual property</h2>
      <p>The Kopi Malay and Tak Route 1 names, logos, designs and photos are our property and may not be reproduced without permission.</p>
      <h2>7. Limitation of liability</h2>
      <p>To the extent permitted by law, Kopi Malay is not liable for indirect losses, courier delays, or events beyond our control. Our liability for any order is limited to the amount paid for it.</p>
      <h2>8. Governing law</h2>
      <p>These terms are governed by the laws of the Kingdom of Thailand.</p>
    </LegalPage>
  ),
});
