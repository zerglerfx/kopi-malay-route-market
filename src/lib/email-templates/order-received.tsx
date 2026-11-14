import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props { name?: string; orderNumber?: string; total?: string; link?: string }

function OrderReceived({ name, orderNumber, total, link }: Props) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`We received order ${orderNumber ?? ""} — track its status anytime`}</Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          <Text style={s.brand}>KOPI MALAY × ROUTE 1</Text>
          <Heading style={s.heading}>Order received</Heading>
          <Text>{name ? `Hi ${name},` : "Hi there,"}</Text>
          <Text>Thanks for your order <strong>{orderNumber}</strong>{total ? ` (${total})` : ""}. We're checking your payment proof now — your order is <strong>Pending Verification</strong>.</Text>
          <Text>Use the button below anytime to see your order's latest status. Keep this email: the link is private to you.</Text>
          {link && <Button href={link} style={s.button}>View order status</Button>}
          <Text style={s.muted}>If the button doesn't work, copy this link into your browser: {link}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const s = {
  body: { backgroundColor: "#ffffff", color: "#252525", fontFamily: "'DM Sans', Arial, sans-serif" },
  container: { maxWidth: "520px", padding: "32px 24px" },
  brand: { fontSize: "12px", fontWeight: 700, color: "#555555" },
  heading: { fontFamily: "'Space Grotesk', Arial, sans-serif", fontSize: "26px", fontWeight: 700 },
  button: { backgroundColor: "#111111", color: "#ffffff", borderRadius: "6px", padding: "12px 20px", fontWeight: 700, textDecoration: "none" },
  muted: { color: "#555555", fontSize: "12px", lineHeight: "18px", wordBreak: "break-all" as const },
};

export const template = {
  component: OrderReceived,
  subject: (d: Record<string, any>) => `Order ${d["orderNumber"] ?? ""} received — Kopi Malay`,
  displayName: "Order received (guest tracking link)",
  previewData: { name: "Ahmad", orderNumber: "KM-12345", total: "RM 45.00", link: "https://kopimalay.com/order-success?ref=KM-12345&t=example" },
} satisfies TemplateEntry;
