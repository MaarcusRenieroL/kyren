import { boardTheme } from "@zentro/ui/lib/theme-colors";

import type { Box } from "./model";

const PADDING = 32;

/** Turns a file URL into a data URL, so an exported picture carries its images. */
async function inline(url: string) {
  const blob = await (await fetch(url)).blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * A standalone SVG of the board's drawing layer, cropped to `area`, with the
 * theme's colours written in and images embedded.
 */
export async function boardSvg(layer: SVGGElement, area: Box, dark: boolean) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const width = area.w + PADDING * 2;
  const height = area.h + PADDING * 2;
  const colours = dark ? boardTheme.export.dark : boardTheme.export.light;
  const ink = colours.ink;

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute(
    "viewBox",
    `${area.x - PADDING} ${area.y - PADDING} ${width} ${height}`,
  );
  svg.setAttribute("style", `color:${ink};background:${colours.background}`);

  const background = document.createElementNS(svg.namespaceURI, "rect");

  background.setAttribute("x", String(area.x - PADDING));
  background.setAttribute("y", String(area.y - PADDING));
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", colours.background);
  svg.appendChild(background);

  const copy = layer.cloneNode(true) as SVGGElement;

  copy.removeAttribute("transform");
  svg.appendChild(copy);

  for (const image of Array.from(copy.querySelectorAll("image"))) {
    const href = image.getAttribute("href");

    if (href && !href.startsWith("data:")) {
      try {
        image.setAttribute("href", await inline(href));
      } catch {
        image.remove();
      }
    }
  }

  return { markup: new XMLSerializer().serializeToString(svg), width, height };
}

/** The same picture as a PNG, at twice the size for sharp text. */
export async function boardPng(layer: SVGGElement, area: Box, dark: boolean) {
  const { markup, width, height } = await boardSvg(layer, area, dark);
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not draw the board."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    const scale = 2;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d")!;

    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Could not export.")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
