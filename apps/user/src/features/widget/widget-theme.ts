import type { VenueBrand } from "@myslot/types";

// Brand tokens -> CSS custom properties. The widget and the branded page both
// resolve a venue's brand (ADR-0028) to runtime vars so one component tree
// serves every venue's look without a theme-per-venue system.
export function brandCssVars(brand?: VenueBrand | null): Record<string, string> {
  return {
    "--brand-primary": brand?.colors?.primary || "#16a34a",
    "--brand-accent": brand?.colors?.accent || "#2563eb"
  };
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}