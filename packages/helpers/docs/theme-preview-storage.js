// Shared by ThemeShowcaseScript (writes previews) and ThemeStorageHydrator
// (re-applies them on every docs page). Bump the version whenever the stored
// CSS changes shape so stale previews are discarded.
module.exports = {
  STORAGE_KEY: "canopy_content_theme_preview",
  STORAGE_VERSION: 3,
};
