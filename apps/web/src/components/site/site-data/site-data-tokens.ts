import type { CSSProperties } from "react";

export const clamp = (x: number) => Math.max(0, Math.min(1, x));

export const LD: Record<string, string> = {
  "--px": "128px",
  "--pr": "64px",
  "--tx": "64px",
  "--h1": "80px",
  "--h2": "56px",
  "--h3": "96px",
  "--lead": "19px",
  "--sec": "160px",
  "--navPL": "53px",
  "--heroT": "120px",
  "--plCols": "repeat(3,minmax(0,1fr))",
  "--cmpCols": "minmax(0,1.6fr) repeat(3,minmax(0,1fr))",
  "--cmpJ": "center",
  "--cmpTA": "center",
  "--adCols": "minmax(0,1fr) 380px",
  "--faqCols": "minmax(0,4fr) minmax(0,7fr)",
  "--gCols": "192px minmax(0,1fr)",
  "--mrCols": "32px minmax(0,1fr) 86px 96px",
  "--mnW": "200px",
  "--mlD": "flex",
  "--repPL": "224px",
  "--shotCols": "200px minmax(0,1fr)",
  "--sbD": "block",
  "--shotH": "500px",
  "--shotP": "26px",
  "--two": "minmax(0,1fr) minmax(0,1fr)",
  "--dhCols": "minmax(0,2.2fr) minmax(0,1fr) 70px 150px",
  "--lkCols": "minmax(0,4fr) minmax(0,7fr)",
  "--mxCols": "minmax(0,1.7fr) repeat(4,minmax(0,1fr))",
  "--lkRow": "32px minmax(0,1fr) 86px",
  "--rmCols": "minmax(0,5fr) minmax(0,6fr)",
  "--rlCols": "repeat(4,minmax(0,1fr))",
  "--chCols": "repeat(5,minmax(0,1fr))",
  "--auCols": "150px 140px minmax(0,1fr) 110px",
  "--clCols": "180px minmax(0,1fr) 120px",
  "--lgCols": "220px minmax(0,720px)",
  "--tocD": "flex",
  "--tocM": "none",
  "--fmCols": "minmax(0,1fr) minmax(0,1fr)",
  "--abCols": "240px minmax(0,1fr)",
  "--stCols": "minmax(0,1fr) auto",
  "--ftCols":
    "minmax(0,1.3fr) minmax(0,.7fr) minmax(0,1.7fr) minmax(0,.7fr) minmax(0,.7fr) auto",
  "--ftSpan": "auto",
};

export const LM: Record<string, string> = {
  "--px": "44px",
  "--pr": "20px",
  "--tx": "20px",
  "--h1": "46px",
  "--h2": "34px",
  "--h3": "50px",
  "--lead": "17px",
  "--sec": "96px",
  "--navPL": "9px",
  "--heroT": "72px",
  "--plCols": "minmax(0,1fr)",
  "--cmpCols": "minmax(0,1.5fr) minmax(0,1fr)",
  "--cmpJ": "flex-end",
  "--cmpTA": "right",
  "--adCols": "minmax(0,1fr)",
  "--faqCols": "minmax(0,1fr)",
  "--gCols": "minmax(0,1fr)",
  "--mrCols": "32px minmax(0,1fr) auto",
  "--mnW": "100%",
  "--mlD": "none",
  "--repPL": "0px",
  "--shotCols": "minmax(0,1fr)",
  "--sbD": "none",
  "--shotH": "420px",
  "--shotP": "16px",
  "--two": "minmax(0,1fr)",
  "--dhCols": "minmax(0,1fr) 92px",
  "--lkCols": "minmax(0,1fr)",
  "--mxCols": "minmax(0,1.4fr) repeat(4,minmax(0,1fr))",
  "--lkRow": "32px minmax(0,1fr) auto",
  "--rmCols": "minmax(0,1fr)",
  "--rlCols": "minmax(0,1fr)",
  "--chCols": "minmax(0,1fr)",
  "--auCols": "minmax(0,1fr)",
  "--clCols": "minmax(0,1fr)",
  "--lgCols": "minmax(0,1fr)",
  "--tocD": "none",
  "--tocM": "block",
  "--fmCols": "minmax(0,1fr)",
  "--abCols": "minmax(0,1fr)",
  "--stCols": "minmax(0,1fr)",
  "--ftCols": "minmax(0,1fr) minmax(0,1fr)",
  "--ftSpan": "1 / -1",
};

export const IC: Record<string, string> = {
  today:
    "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='2.5' fill='black'/>",
  tasks:
    "<rect x='4' y='4' width='16' height='16' rx='4'/><path d='M8.5 12.5l2.5 2.5 4.5-5'/>",
  projects:
    "<rect x='4' y='4' width='7' height='7' rx='2'/><rect x='13' y='4' width='7' height='7' rx='2'/><rect x='4' y='13' width='7' height='7' rx='2'/><rect x='13' y='13' width='7' height='7' rx='2'/>",
  docs: "<path d='M7 3.5h7l4 4v13H6v-17z'/><path d='M9 12h6M9 16h4'/>",
  team: "<circle cx='9' cy='9' r='3.2'/><circle cx='16.5' cy='10' r='2.5'/><path d='M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M15 14.6c2.3-.3 4.2.9 5 3.4'/>",
  search: "<circle cx='11' cy='11' r='6.5'/><path d='M16 16l4 4'/>",
  plus: "<path d='M12 5v14M5 12h14'/>",
  chev: "<path d='M7 10l5 5 5-5'/>",
  check: "<path d='M5 12.5l4.5 4.5L19 7.5'/>",
  bell: "<path d='M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z'/><path d='M10 20.5h4'/>",
  link: "<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>",
  bold: "<path d='M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z'/>",
  italic: "<path d='M10 5h8M6 19h8M14 5l-4 14'/>",
  bullets:
    "<circle cx='5' cy='7' r='1' fill='black'/><circle cx='5' cy='12' r='1' fill='black'/><circle cx='5' cy='17' r='1' fill='black'/><path d='M9 7h11M9 12h11M9 17h11'/>",
  checklist:
    "<rect x='3.5' y='4.5' width='6' height='6' rx='1.5'/><path d='M5 7.5l1 1 2-2M13 7.5h8M13 16.5h8'/><rect x='3.5' y='13.5' width='6' height='6' rx='1.5'/>",
  code: "<path d='M8 7l-5 5 5 5M16 7l5 5-5 5'/>",
  x: "<path d='M6 6l12 12M18 6L6 18'/>",
  menu: "<path d='M4 8h16M4 16h16'/>",
  list: "<path d='M4 6h16M4 12h16M4 18h16'/>",
  board:
    "<rect x='3.5' y='4' width='5' height='16' rx='1.5'/><rect x='10.5' y='4' width='5' height='11' rx='1.5'/><rect x='17.5' y='4' width='3' height='7' rx='1'/>",
  sun: "<circle cx='12' cy='12' r='4'/><path d='M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'/>",
  moon: "<path d='M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z'/>",
  monitor:
    "<rect x='3.5' y='4.5' width='17' height='11.5' rx='2.5'/><path d='M9 20h6M12 16v4'/>",
  arrowR: "<path d='M5 12h14M13 6l6 6-6 6'/>",
  fwd: "<path d='M9 6l6 6-6 6'/>",
  alert: "<circle cx='12' cy='12' r='8.5'/><path d='M12 7.5v5.5M12 16.2v.3'/>",
};

const URL_: Record<string, string> = {};
Object.keys(IC).forEach((k) => {
  URL_[k] =
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>${IC[k]}</svg>`)}")`;
});

export const ic = (n: string, s = 16, c = "currentColor"): CSSProperties => ({
  width: s,
  height: s,
  flex: "none",
  display: "inline-block",
  backgroundColor: c,
  WebkitMaskImage: URL_[n],
  maskImage: URL_[n],
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
});

export const mono = "var(--font-geist-mono), ui-monospace, monospace";

export const TINT: Record<string, string> = {
  Work: "var(--sky)",
  Knowledge: "var(--lav)",
  Talk: "var(--peach)",
  Company: "var(--mint)",
};

export const GROUPS = ["Work", "Knowledge", "Talk", "Company"];

export const PPL: Record<string, [string, string]> = {
  PR: ["Priya Raman", "var(--lav)"],
  AM: ["Arjun Mehta", "var(--sky)"],
  MI: ["Meera Iyer", "var(--peach)"],
  TB: ["Tom Becker", "var(--mint)"],
  LH: ["Lena Hoffmann", "var(--rosep)"],
};
