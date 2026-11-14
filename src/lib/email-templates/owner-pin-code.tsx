import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  code?: string;
}

function OwnerPinCode({ code }: Props) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your Kopi Malay Owner PIN verification code</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>KOPI MALAY × ROUTE 1</Text>
          <Heading style={styles.heading}>Owner PIN verification</Heading>
          <Text>Use this code to set or reset your Owner PIN.</Text>
          <Section style={styles.codeBox}>
            <Text style={styles.code}>{code || "———"}</Text>
          </Section>
          <Text>This code expires in 10 minutes and can only be used once. Do not share it with anyone.</Text>
          <Text style={styles.muted}>If you did not request this code, do not use it. Your PIN has not been changed.</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: "#ffffff", color: "#252525", fontFamily: "'DM Sans', Arial, sans-serif" },
  container: { maxWidth: "520px", padding: "32px 24px" },
  brand: { fontSize: "12px", fontWeight: 700, color: "#555555" },
  heading: { fontFamily: "'Space Grotesk', Arial, sans-serif", fontSize: "26px", fontWeight: 700 },
  codeBox: { backgroundColor: "#f4f4f4", border: "1px solid #dedede", borderRadius: "6px", textAlign: "center" as const },
  code: { fontSize: "32px", fontWeight: 700, margin: "20px 0" },
  muted: { color: "#555555", fontSize: "13px", lineHeight: "20px" },
};

export const template = {
  component: OwnerPinCode,
  subject: "Your Owner PIN verification code — Kopi Malay",
  displayName: "Owner PIN verification code",
  previewData: { code: "123456" },
} satisfies TemplateEntry;