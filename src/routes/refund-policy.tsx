import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/legal-page";

export const Route = createFileRoute("/refund-policy")({
  head: () => legalHead("/refund-policy", "Refund Policy", "How Kopi Malay handles QR payment verification, cancellations, store credit and refunds."),
  component: () => (
    <LegalPage title="Refund Policy">
      <h2>1. Payment verification</h2>
      <p>All orders are paid by manual QR transfer (DuitNow / Touch 'n Go for Malaysia, PromptPay for Thailand). After you upload your receipt, your order is marked "Pending Verification" until our team confirms the payment matches the order total.</p>
      <p>If a receipt cannot be verified (wrong amount, unreadable, or no payment received), we will contact you. Unverified orders may be cancelled.</p>
      <h2>2. Cancellations</h2>
      <ul>
        <li>You may cancel before your order is shipped by contacting us with your order reference.</li>
        <li>Verified payments for cancelled orders are refunded to the original account, or as store credit if you prefer.</li>
        <li>Orders already handed to the courier cannot be cancelled.</li>
      </ul>
      <h2>3. Issue-based refunds</h2>
      <p>If an item arrives damaged, defective or incorrect, message us within 7 days of delivery with your order reference and photos. We will offer a replacement, store credit or refund.</p>
      <h2>4. Non-refundable cases</h2>
      <ul>
        <li>Change of mind after shipping, or wrong size chosen (exchanges may be possible — see Shipping & Returns).</li>
        <li>Items that have been used, washed or damaged after delivery.</li>
        <li>Shipping fees, except where the error was ours.</li>
      </ul>
      <h2>5. Processing time</h2>
      <p>Approved refunds are processed within 7 working days. Overpayments are returned the same way.</p>
    </LegalPage>
  ),
});
