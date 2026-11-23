/* eslint-disable @typescript-eslint/no-explicit-any */
export function CloseHeadings({ cl, md }: { cl: any; md: any }) {
  const h2Style = {
    margin: "0",
    fontFamily: "var(--font-bricolage), var(--font-geist), sans-serif",
    fontWeight: "700",
    fontSize: "var(--h3)",
    lineHeight: "0.95",
    letterSpacing: "-0.045em",
    textWrap: "balance" as const,
  };

  const emStyle = {
    fontFamily: "var(--font-instrument-serif), serif",
    fontStyle: "italic",
    fontWeight: "400",
    fontSize: "1.1em",
    letterSpacing: "-0.01em",
  };

  return (
    <>
      {cl.pricing ? (
        <h2 style={h2Style}>
          Start with the live modules <em style={emStyle}>today</em>.
        </h2>
      ) : null}
      {cl.modules ? (
        <h2 style={h2Style}>
          Turn on the modules you <em style={emStyle}>need</em>.
        </h2>
      ) : null}
      {cl.module ? (
        <h2 style={h2Style}>
          Turn on {md.n} in your <em style={emStyle}>workspace</em>.
        </h2>
      ) : null}
      {cl.roadmap ? (
        <h2 style={h2Style}>
          Use what is <em style={emStyle}>live</em> while you wait.
        </h2>
      ) : null}
      {cl.security ? (
        <h2 style={h2Style}>
          Set up your roles on day <em style={emStyle}>one</em>.
        </h2>
      ) : null}
      {cl.changelog ? (
        <h2 style={h2Style}>
          Try what shipped this <em style={emStyle}>month</em>.
        </h2>
      ) : null}
    </>
  );
}
