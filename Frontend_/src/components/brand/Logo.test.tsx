import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  LogoLockup,
  LogoMark,
  PRODUCT_MARK_SMALL_SRC,
  PRODUCT_MARK_SRC,
  PRODUCT_NAME,
  PRODUCT_SUBTITLE,
  ProductMark,
  TEAM_CREDIT,
  TeamCredit,
} from "./Logo";
import { axeViolations } from "@/test/axe";

const FRONTEND = resolve(__dirname, "../../..");
const readPublic = (p: string) => readFileSync(resolve(FRONTEND, "public", p.replace(/^\//, "")), "utf8");

/** Approved logo palette (D.1 §11.2). */
const ALLOWED_COLOURS = new Set(["#14224A", "#070E21", "#516CA3", "#445189", "#6E90C2", "#6A58B0", "#8C79D6", "#FAFCFC", "#FFFFFF", "#C9D3EC"]);

describe("product logo wording", () => {
  it("uses the exact fixed wording", () => {
    expect(PRODUCT_NAME).toBe("Astera Watch");
    expect(PRODUCT_SUBTITLE).toBe("Wildfire Surface-Change Monitoring with NASA NISAR Radar");
    expect(TEAM_CREDIT).toBe("Team Astera · NASA Space Apps Challenge");
  });
});

describe("ProductMark", () => {
  it.each([
    [16, PRODUCT_MARK_SMALL_SRC],
    [32, PRODUCT_MARK_SMALL_SRC],
    [47, PRODUCT_MARK_SMALL_SRC],
    [48, PRODUCT_MARK_SRC],
    [64, PRODUCT_MARK_SRC],
  ])("auto variant at %ipx uses %s", (size, src) => {
    const { container } = render(<ProductMark size={size} />);
    expect(container.querySelector("img")).toHaveAttribute("src", src);
  });

  it("forced variants override the size switch", () => {
    const { container } = render(
      <>
        <ProductMark size={16} variant="badge" />
        <ProductMark size={96} variant="small" />
      </>,
    );
    const [a, b] = container.querySelectorAll("img");
    expect(a).toHaveAttribute("src", PRODUCT_MARK_SRC);
    expect(b).toHaveAttribute("src", PRODUCT_MARK_SMALL_SRC);
  });

  it("has an accessible name only when labelled; otherwise it is decorative", () => {
    const { container } = render(
      <>
        <ProductMark label="Astera Watch" />
        <ProductMark />
      </>,
    );
    expect(screen.getByRole("img", { name: "Astera Watch" })).toBeInTheDocument();
    const imgs = container.querySelectorAll("img");
    expect(imgs[1]).toHaveAttribute("alt", "");
    expect(imgs[1]).toHaveAttribute("aria-hidden", "true");
  });

  it("does not shrink inside a narrow flex container", () => {
    const { container } = render(
      <div style={{ display: "flex", width: 10 }}>
        <ProductMark size={32} />
        <span>long neighbouring text that would otherwise squeeze the mark</span>
      </div>,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveStyle({ flexShrink: "0", width: "32px", height: "32px", minWidth: "32px" });
    expect(img).toHaveAttribute("width", "32");
    expect(img).toHaveAttribute("height", "32");
  });
});

describe("LogoLockup", () => {
  it.each([
    ["horizontal", PRODUCT_MARK_SRC, 56],
    ["stacked", PRODUCT_MARK_SRC, 96],
    ["compact", PRODUCT_MARK_SMALL_SRC, 32],
  ] as const)("%s layout uses %s at %ipx", (layout, src, size) => {
    const { container } = render(<LogoLockup layout={layout} />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", src);
    expect(img).toHaveAttribute("width", String(size));
  });

  it("legacy compact prop still selects the compact layout (C1)", () => {
    const { container } = render(<LogoLockup compact />);
    expect(container.querySelector("img")).toHaveAttribute("src", PRODUCT_MARK_SMALL_SRC);
    expect(screen.getByText(PRODUCT_NAME)).toBeInTheDocument();
  });

  it("shows the exact subtitle in horizontal and stacked layouts only", () => {
    render(<LogoLockup layout="horizontal" />);
    expect(screen.getByText(PRODUCT_SUBTITLE)).toBeInTheDocument();
    render(<LogoLockup layout="compact" />);
    expect(screen.getAllByText(PRODUCT_SUBTITLE)).toHaveLength(1);
  });

  it("has no axe-core WCAG A/AA violations", async () => {
    const { container } = render(
      <>
        <LogoLockup layout="horizontal" />
        <LogoLockup layout="stacked" />
        <LogoLockup layout="compact" />
        <ProductMark label="Astera Watch" size={64} />
        <TeamCredit />
      </>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("team logo (backward compatibility)", () => {
  it("LogoMark still renders the unchanged team badge", () => {
    const { container } = render(<LogoMark />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/astera-logo.jpg");
    expect(img.parentElement).toHaveStyle({ width: "40px", height: "40px" });
  });

  it("TeamCredit shows the exact credit with the team badge", () => {
    const { container } = render(<TeamCredit />);
    expect(screen.getByText(TEAM_CREDIT)).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "/astera-logo.jpg");
  });
});

describe("logo files", () => {
  it.each([PRODUCT_MARK_SRC, PRODUCT_MARK_SMALL_SRC])("%s is a safe SVG using only the approved palette", (src) => {
    const svg = readPublic(src);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg).not.toMatch(/<text|<script|<image|<foreignObject|\bon[a-z]+=/i);
    expect(svg).not.toMatch(/(href|src)="(?!#)/); // only internal references
    const colours = new Set((svg.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((c) => c.toUpperCase()));
    expect(colours.size).toBeGreaterThan(0);
    for (const c of colours) expect(ALLOWED_COLOURS, c).toContain(c);
  });

  it("index.html uses the small mark (C1) as the favicon", () => {
    const html = readFileSync(resolve(FRONTEND, "index.html"), "utf8");
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${PRODUCT_MARK_SMALL_SRC}" />`);
    expect(html).not.toContain('rel="icon" type="image/jpeg"');
  });
});
