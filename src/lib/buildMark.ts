import { execSync } from "node:child_process";

/** Short git SHA at compile time — changes every commit/build. */
export function getBuildHash(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/** Human-readable label baked into HTML/CSS at build time. */
export function getBuildLabel(): string {
  const hash = getBuildHash();
  const builtAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `${hash} · ${builtAt}`;
}

/**
 * Build mark visibility:
 * - local `astro dev` → on
 * - Netlify deploy-preview / branch-deploy → on
 * - Netlify production (warthog.network) → off, stripped from HTML
 */
export function shouldShowBuildMark(): boolean {
  if (import.meta.env.DEV) return true;

  const context = process.env.CONTEXT;
  if (context === "production") return false;

  if (context === "deploy-preview" || context === "branch-deploy") return true;

  return false;
}