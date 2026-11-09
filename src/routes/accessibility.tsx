import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/legal-page";

export const Route = createFileRoute("/accessibility")({
  head: () => legalHead("/accessibility", "Accessibility Statement", "Kopi Malay's commitment to an accessible, mobile-first shop for every rider and shopper."),
  component: () => (
    <LegalPage title="Accessibility Statement">
      <p>Kopi Malay wants every adventure rider and shopper — on the road or at home — to be able to browse, order and request help on our website, including people who use assistive technologies.</p>
      <h2>Our approach</h2>
      <ul>
        <li>We aim to follow the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.</li>
        <li>A high-contrast black, white and grey design for readability in bright outdoor light.</li>
        <li>Mobile-first layouts that resize and support browser zoom.</li>
        <li>Keyboard navigation, visible focus states and labelled buttons, links and form fields.</li>
        <li>Descriptive text for product images and clear error messages on checkout and towing forms.</li>
        <li>Compatibility with screen readers such as VoiceOver, TalkBack and NVDA.</li>
      </ul>
      <h2>Known limitations</h2>
      <p>Some uploaded product photos and third-party courier labels may not have full text alternatives. We continue to improve them.</p>
      <h2>Feedback</h2>
      <p>If you have difficulty using any part of the site, message us on WhatsApp at +66 97 009 8182. We will help you complete your order or request and work to fix the issue.</p>
    </LegalPage>
  ),
});
