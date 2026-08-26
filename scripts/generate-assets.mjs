import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, "..");
const publicDirectory = join(projectRoot, "public");
const appDirectory = join(projectRoot, "src", "app");

await Promise.all([
  mkdir(publicDirectory, { recursive: true }),
  mkdir(appDirectory, { recursive: true }),
]);

const iconSvg = await readFile(join(publicDirectory, "icon.svg"), "utf8");
const iconSource = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`;

function iconArtwork(size) {
  return h(
    "div",
    {
      style: {
        alignItems: "center",
        background: "#ff3b30",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      },
    },
    h("img", {
      alt: "",
      height: size,
      src: iconSource,
      width: size,
    }),
  );
}

function ogArtwork() {
  return h(
    "div",
    {
      style: {
        alignItems: "stretch",
        background:
          "linear-gradient(135deg, #fffdfc 0%, #f6f3f1 55%, #eee8e5 100%)",
        color: "#161513",
        display: "flex",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "space-between",
        overflow: "hidden",
        padding: "70px 76px",
        position: "relative",
        width: "100%",
      },
    },
    h("div", {
      style: {
        background: "#ff3b30",
        borderRadius: "999px",
        height: "390px",
        opacity: 0.08,
        position: "absolute",
        right: "-120px",
        top: "-180px",
        width: "390px",
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "690px",
        },
      },
      h(
        "div",
        {
          style: {
            alignItems: "center",
            color: "#ff3b30",
            display: "flex",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "0.12em",
          },
        },
        h("span", {
          style: {
            background: "#ff3b30",
            borderRadius: "999px",
            height: "10px",
            marginRight: "16px",
            width: "10px",
          },
        }),
        "PROCRASTINATION, MEASURED.",
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: "90px",
              fontWeight: 800,
              letterSpacing: "-0.055em",
              lineHeight: 0.92,
            },
          },
          "ATO 5 FUN",
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: "90px",
              fontWeight: 800,
              letterSpacing: "-0.055em",
              lineHeight: 0.92,
            },
          },
          "COUNTER",
        ),
      ),
      h(
        "div",
        {
          style: {
            color: "#706b67",
            display: "flex",
            fontSize: "29px",
            fontWeight: 500,
            letterSpacing: "-0.01em",
          },
        },
        "Five more minutes. Again.",
      ),
    ),
    h(
      "div",
      {
        style: {
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          width: "350px",
        },
      },
      h("img", {
        alt: "",
        height: 330,
        src: iconSource,
        style: {
          borderRadius: "76px",
          boxShadow: "0 34px 70px rgba(163, 25, 16, 0.24)",
        },
        width: 330,
      }),
    ),
  );
}

async function renderPng(element, width, height) {
  const response = new ImageResponse(element, { width, height });
  return Buffer.from(await response.arrayBuffer());
}

function wrapPngAsIco(png, width, height) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(width === 256 ? 0 : width, 6);
  header.writeUInt8(height === 256 ? 0 : height, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

const iconOutputs = [
  [join(publicDirectory, "icon-192.png"), 192],
  [join(publicDirectory, "icon-192x192.png"), 192],
  [join(publicDirectory, "icon-512.png"), 512],
  [join(publicDirectory, "icon-512x512.png"), 512],
  [join(publicDirectory, "icon-maskable-512.png"), 512],
  [join(publicDirectory, "icon-maskable-512x512.png"), 512],
  [join(publicDirectory, "apple-touch-icon.png"), 180],
  [join(appDirectory, "apple-icon.png"), 180],
];

for (const [outputPath, size] of iconOutputs) {
  const png = await renderPng(iconArtwork(size), size, size);
  await writeFile(outputPath, png);
  console.log(`Generated ${outputPath.slice(projectRoot.length + 1)} (${size}x${size})`);
}

const faviconPng = await renderPng(iconArtwork(32), 32, 32);
await writeFile(
  join(appDirectory, "favicon.ico"),
  wrapPngAsIco(faviconPng, 32, 32),
);
console.log("Generated src/app/favicon.ico (32x32)");

const ogImage = await renderPng(ogArtwork(), 1200, 630);
for (const outputPath of [
  join(publicDirectory, "og-image.png"),
  join(appDirectory, "opengraph-image.png"),
  join(appDirectory, "twitter-image.png"),
]) {
  await writeFile(outputPath, ogImage);
  console.log(`Generated ${outputPath.slice(projectRoot.length + 1)} (1200x630)`);
}
