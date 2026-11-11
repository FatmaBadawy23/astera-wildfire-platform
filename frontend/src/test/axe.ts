import axe from "axe-core";

/**
 * Runs axe-core (WCAG 2.0/2.1/2.2 A + AA rules) on a container and returns violations.
 * Note: jsdom does not render CSS, so colour-contrast results are "incomplete" here; contrast is
 * verified separately from the design tokens (docs/design/02-design-tokens.md, validation V5).
 */
export async function axeViolations(container: Element) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
  });
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
}
