/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@kyren/ui/shadcn/button";
export function AboutContactSent({ v }: { v: any }) {
  const { ico, sentName, sentEmail, resetForm } = v;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "32px 0",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "99px",
          background: "var(--green)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={ico.checkInv}></span>
      </span>
      <span
        style={{
          fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
          fontWeight: "700",
          fontSize: "30px",
          letterSpacing: "-0.03em",
        }}
      >
        Thanks, {sentName}.
      </span>
      <span
        style={{
          fontSize: "17px",
          lineHeight: "1.55",
          color: "var(--ink2)",
        }}
      >
        Your message is with us. We will reply to {sentEmail}.
      </span>
      <Button
        variant="custom"
        onClick={resetForm}
        style={{
          alignSelf: "flex-start",
          height: "40px",
          padding: "0 16px",
          borderRadius: "999px",
          border: "1px solid var(--line)",
          background: "transparent",
          color: "var(--ink)",
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        Send another message
      </Button>
    </div>
  );
}
