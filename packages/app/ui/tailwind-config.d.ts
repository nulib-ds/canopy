import type { Config } from 'tailwindcss';

/**
 * @deprecated Removed in the next major release. Tailwind v4 reads a JS config
 * only through `@config`; customize Tailwind in `app/styles/index.css`.
 */
export interface DefineCanopyTailwindConfigOptions extends Config {
  /**
   * Override the detected project root (defaults to two directories up from the config file).
   */
  root?: string;
  includeCanopyPreset?: boolean;
  includeCanopyPlugin?: boolean;
  includeCanopySafelist?: boolean;
  includeCanopySources?: boolean;
}

export type TailwindConfigSource = string | URL;

/**
 * @deprecated Removed in the next major release. Tailwind v4 reads a JS config
 * only through `@config`; customize Tailwind in `app/styles/index.css`.
 */
export declare function defineCanopyTailwindConfig(
  sourceOrOptions?: TailwindConfigSource | DefineCanopyTailwindConfigOptions,
  maybeOptions?: DefineCanopyTailwindConfigOptions
): Config;

export default defineCanopyTailwindConfig;
