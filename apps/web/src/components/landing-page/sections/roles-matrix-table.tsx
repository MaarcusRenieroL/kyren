import { MATRIX } from "../landing-data";
import { MONO, label } from "../landing-styles";

export function RolesMatrixTable({ mx }: { mx: number }) {
  return (
    <div
      style={{
        flex: "1 1 620px",
        minWidth: 0,
        backgroundColor: "var(--tile)",
        backgroundImage: "var(--glass)",
        border: "1px solid var(--line)",
        borderRadius: 20,
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "16px 20px",
          borderBottom: "1px solid var(--line2)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Roles</span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--ink3)",
          }}
        >
          Example workspace
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--ink3)",
          }}
        >
          Editing: Member
        </span>
      </div>
      <div role="table" aria-label="Permission matrix">
        <div
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "var(--mxCols)",
            height: 52,
            alignItems: "stretch",
          }}
        >
          <div
            role="columnheader"
            style={{
              ...label,
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
            }}
          >
            Permission
          </div>
          {["Owner", "Admin", "Member", "Custom"].map((role, i) => (
            <div
              key={role}
              role="columnheader"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                  i === mx
                    ? "color-mix(in oklab, var(--accent) 9%, transparent)"
                    : "transparent",
              }}
            >
              <span
                style={
                  i === mx
                    ? {
                        fontFamily: MONO,
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "var(--accent)",
                        color: "var(--accent-ink)",
                      }
                    : {
                        fontFamily: MONO,
                        fontSize: 11,
                        color: "var(--ink2)",
                      }
                }
              >
                {role}
              </span>
            </div>
          ))}
        </div>
        {MATRIX.map(([mod, act, values]) => (
          <div
            key={`${mod}-${act}`}
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: "var(--mxCols)",
              minHeight: 46,
              borderTop: "1px solid var(--line2)",
            }}
          >
            <div
              role="rowheader"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                fontSize: 14,
                minWidth: 0,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontWeight: 500 }}>{mod}</span>
              <span style={{ color: "var(--ink2)" }}>{act}</span>
            </div>
            {values.map((v, i) => (
              <div
                key={i}
                role="cell"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    i === mx
                      ? "color-mix(in oklab, var(--accent) 9%, transparent)"
                      : "transparent",
                }}
              >
                {v === 2 ? (
                  <span
                    aria-label="Full access"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 99,
                      background: "var(--ink)",
                    }}
                  />
                ) : v === 1 ? (
                  <span
                    aria-label="Own only"
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: "var(--ink2)",
                      border: "1px solid var(--line)",
                      borderRadius: 99,
                      padding: "1px 7px",
                    }}
                  >
                    own
                  </span>
                ) : (
                  <span
                    data-dim=""
                    aria-label="No access"
                    style={{
                      width: 10,
                      height: 1.5,
                      background: "var(--ink3)",
                      opacity: 0.6,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
