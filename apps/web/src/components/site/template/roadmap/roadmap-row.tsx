/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@zentro/ui/shadcn/button";
import { Fragment } from "react";

export function RoadmapRow({ r, ico }: { r: any; ico: any }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--rmCols)",
        gap: "28px 64px",
        padding: "40px 0",
        borderTop: "1px solid var(--line2)",
        alignItems: "start",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <span style={r.codeSt}>{r.code}</span>
          <span
            style={{
              fontFamily:
                "var(--font-bricolage), var(--font-geist), sans-serif",
              fontWeight: "700",
              fontSize: "30px",
              letterSpacing: "-0.03em",
            }}
          >
            {r.n}
          </span>
          <span
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: "11px",
              color: "var(--ink2)",
              border: "1px dashed var(--ink3)",
              borderRadius: "999px",
              padding: "2px 9px",
            }}
          >
            Coming
          </span>
        </div>
        <p
          style={{
            margin: "0",
            maxWidth: "440px",
            fontSize: "17px",
            lineHeight: "1.55",
            color: "var(--ink2)",
            textWrap: "pretty",
          }}
        >
          {r.d}
        </p>
        {r.notN ? (
          <Button
            variant="custom"
            onClick={r.click}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "42px",
              padding: "0 18px",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: "transparent",
              color: "var(--ink)",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            <span style={ico.bell}></span>Notify me
          </Button>
        ) : null}
        {r.isN ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              minHeight: "42px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "99px",
                background: "var(--green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={ico.checkInv}></span>
            </span>
            <span style={{ fontSize: "14px" }}>{r.done}</span>
            <Button
              variant="custom"
              onClick={r.click}
              style={{
                height: "30px",
                padding: "0 10px",
                border: "none",
                background: "none",
                color: "var(--ink3)",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Undo
            </Button>
          </div>
        ) : null}
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            color: "var(--ink3)",
          }}
        >
          No date yet
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          minWidth: "0",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "11px",
            letterSpacing: ".08em",
            color: "var(--ink2)",
          }}
        >
          PREVIEW · NOT LIVE
        </span>
        <div
          style={{
            pointerEvents: "none",
            opacity: ".42",
            WebkitMaskImage: "linear-gradient(180deg, black 45%, transparent)",
            maskImage: "linear-gradient(180deg, black 45%, transparent)",
          }}
        >
          <div
            style={{
              borderRadius: "20px",
              border: "1px dashed var(--line)",
              padding: "6px 16px 10px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: "36px",
                fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: "11px",
                color: "var(--ink3)",
                borderBottom: "1px solid var(--line2)",
              }}
            >
              {r.url}
            </div>
            {r.prev.map((x: any, i33: number) => (
              <Fragment key={i33}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    minHeight: "50px",
                    borderBottom: "1px solid var(--line2)",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>
                    {x.a}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily:
                        "var(--font-geist-mono), ui-monospace, monospace",
                      fontSize: "12px",
                      color: "var(--ink2)",
                      textAlign: "right",
                    }}
                  >
                    {x.b}
                  </span>
                </div>
              </Fragment>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                height: "50px",
              }}
            >
              <span
                style={{
                  width: "40%",
                  height: "8px",
                  borderRadius: "6px",
                  background: "var(--line)",
                }}
              ></span>
              <span
                style={{
                  marginLeft: "auto",
                  width: "18%",
                  height: "8px",
                  borderRadius: "6px",
                  background: "var(--line2)",
                }}
              ></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
