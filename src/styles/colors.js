// Single source of truth for site-wide theme colors.
// Consumed two ways: Layout.astro turns these into global CSS variables
// (--background, --accentRed, ...) for use in any <style> block, and
// component scripts import this module directly when they need the raw
// value (e.g. handing a hex string to d3.scaleOrdinal).
export const colors = {
  background: "#f5f2e6",
  accentRed: "#c0392b",
  accentGreen: "#2c6e49",
  linkStroke: "#999999",
  nodeStroke: "#000000",
  accentBrown: "#342b2b",
  lightBrown: "#635f5b",
  neonColor: "#ccff00",
  charcoal: "#181818",
};
