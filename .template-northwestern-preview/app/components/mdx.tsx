/**
 * Replace the examples with your own components or add new ones. You
 * may also import components from dependencies and re-export them here.
 */

// Map SSR-safe components to be rendered at build time and used in MDX files
export const components = {
  Example: './Example.tsx',
};

// Map browser-only components to their source files; the builder bundles
// them separately and hydrates placeholders at runtime.
export const clientComponents = {
  ExampleClient: './Example.client.tsx',
  StoryMapJS: './StoryMapJS.client.tsx',
};
