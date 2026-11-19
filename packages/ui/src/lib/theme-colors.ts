// The browser chrome color (mobile address bar) for each color scheme. These
// are the canvas token converted to sRGB; this file is part of the token layer.
export const themeColors = {
  light: "#f6f5f1",
  dark: "#0a0a0f",
} as const;

export const densityCookie = "zentro-density";
export const densities = ["comfortable", "compact"] as const;
export type Density = (typeof densities)[number];

export function parseDensity(value: string | undefined | null): Density {
  return value === "compact" ? "compact" : "comfortable";
}

// Brand colors for places that cannot read CSS variables (icons, social
// images). They are the signal color and its text color in sRGB.
export const brandColors = {
  accent: "#5b3fe0",
  onAccent: "#ffffff",
  paper: themeColors.light,
  ink: "#17161c",
} as const;

// Pen colors for whiteboards. They are saved with the drawing, so they stay
// the same in both color schemes ("ink" follows the scheme instead).
export const boardColors = [
  "ink",
  "#dc2626",
  "#d97706",
  "#16a34a",
  "#2563eb",
  "#7c3aed",
] as const;

/**
 * The whiteboard's fixed colours. A board is a shared picture, so these stay
 * the same in both themes (only "ink" follows the theme).
 */
export const boardTheme = {
  stickies: ["#fff3a3", "#ffd6a5", "#ffc6d9", "#caffbf", "#bde0fe", "#d7c8ff"],
  neutralFill: "#e9ecef",
  text: "#1f2937",
  frame: "#868e96",
  connector: "#495057",
  shadow: "#000000",
  task: {
    fill: "#e7f1ff",
    border: "#4c6ef5",
    key: "#364fc7",
    status: "#495057",
    title: "#212529",
  },
  checker: "#dddddd",
  export: {
    light: { ink: "#1e1e1e", background: "#ffffff" },
    dark: { ink: "#f1f3f5", background: "#121212" },
  },
} as const;
