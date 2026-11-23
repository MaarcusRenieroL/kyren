/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@kyren/ui/shadcn/button";
export function FooterTheme({
  th,
  thIc,
  setLight,
  setDark,
  setSys,
}: {
  th: any;
  thIc: any;
  setLight: any;
  setDark: any;
  setSys: any;
}) {
  return (
    <div
      style={{
        gridColumn: "var(--ftSpan)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: "11px",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          color: "var(--ink3)",
        }}
      >
        Theme
      </span>
      <div
        style={{
          display: "flex",
          gap: "2px",
          padding: "3px",
          border: "1px solid var(--line)",
          borderRadius: "999px",
          alignSelf: "flex-start",
        }}
      >
        <Button
          variant="custom"
          style={th.light}
          onClick={setLight}
          aria-label="Light theme"
          title="Light"
        >
          <span style={thIc.light}></span>
        </Button>
        <Button
          variant="custom"
          style={th.dark}
          onClick={setDark}
          aria-label="Dark theme"
          title="Dark"
        >
          <span style={thIc.dark}></span>
        </Button>
        <Button
          variant="custom"
          style={th.sys}
          onClick={setSys}
          aria-label="System theme"
          title="System"
        >
          <span style={thIc.sys}></span>
        </Button>
      </div>
    </div>
  );
}
