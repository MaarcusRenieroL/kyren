/* eslint-disable @typescript-eslint/no-explicit-any */
import { CloseHeadings } from "./close-headings";
import { hrefOf } from "./common";

export function SiteCloseSection({ v }: { v: any }) {
  const {
    showClose,
    track,
    fillEnd,
    endNode,
    rv,
    cl,
    md,
    closeLead,
    close2,
  } = v;

  if (!showClose) return null;

  return (
    <section
      style={{
        position: "relative",
        padding: "0 var(--pr) 0 var(--px)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          bottom: "0",
          left: "30%",
          width: "140px",
          background: "linear-gradient(to bottom, transparent, var(--beam) 60%, transparent)",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          top: "0",
          bottom: "0",
          left: "64%",
          width: "220px",
          background: "linear-gradient(to bottom, var(--beam), transparent 90%)",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          left: "20%",
          top: "120px",
          width: "1200px",
          height: "700px",
          background: "radial-gradient(closest-side, var(--halo), transparent)",
          opacity: ".6",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          left: "0",
          right: "0",
          top: "80px",
          height: "700px",
          background: "radial-gradient(closest-side, var(--wash), transparent)",
          pointerEvents: "none",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 0.75px)",
          top: "0",
          height: "var(--sec)",
          width: "1.5px",
        }}
      >
        <div style={track}></div>
        <div style={fillEnd}></div>
      </div>
      <div
        style={{
          position: "absolute",
          left: "calc(var(--tx) - 7px)",
          top: "calc(var(--sec) - 5px)",
        }}
      >
        <div style={endNode}></div>
      </div>
      <div data-rv="12" style={rv.r12}>
        <div
          style={{
            position: "relative",
            padding: "var(--sec) 0",
            display: "flex",
            flexDirection: "column",
            gap: "28px",
            maxWidth: "1040px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "12px",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink3)",
            }}
          >
            Start
          </span>
          <CloseHeadings cl={cl} md={md} />
          <p
            style={{
              margin: "0",
              maxWidth: "560px",
              fontSize: "var(--lead)",
              lineHeight: "1.5",
              color: "var(--ink2)",
              textWrap: "pretty",
            }}
          >
            {closeLead}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <a
              href={v.signedIn ? "/dashboard" : "/auth/sign-up"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "56px",
                padding: "0 30px",
                borderRadius: "999px",
                background: "var(--btn)",
                color: "var(--btn-ink)",
                fontSize: "16px",
                fontWeight: "500",
                textDecoration: "none",
              }}
            >
              {v.signedIn ? "Open Zentro" : "Get started"}
            </a>
            <a
              href={hrefOf(close2.go)}
              onClick={close2.go}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "56px",
                padding: "0 26px",
                borderRadius: "999px",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                fontSize: "16px",
                fontWeight: "500",
                textDecoration: "none",
              }}
            >
              {close2.t}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
