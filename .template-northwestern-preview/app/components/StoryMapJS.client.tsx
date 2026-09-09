import {withBasePath} from '@canopy-iiif/app/base-path';
import React, {useEffect, useId, useMemo, useRef} from 'react';

type StoryMapData = string | Record<string, unknown>;
type StoryMapOptions = Record<string, unknown>;

type KnightLabStoryMap = {
  StoryMap: new (
    id: string,
    data: StoryMapData,
    options?: StoryMapOptions
  ) => {updateDisplay: () => void; destroy?: () => void};
};

const STORYMAP_STYLE = 'https://cdn.knightlab.com/libs/storymapjs/latest/css/storymap.css';
const STORYMAP_SCRIPT = 'https://cdn.knightlab.com/libs/storymapjs/latest/js/storymap-min.js';

const loaders = new Map<string, Promise<void>>();

function loadAsset(kind: 'script' | 'style', url: string) {
  if (!loaders.has(url)) {
    loaders.set(
      url,
      new Promise<void>((resolve, reject) => {
        const tag = document.createElement(kind === 'script' ? 'script' : 'link');
        if (kind === 'script') {
          tag.setAttribute('src', url);
          tag.setAttribute('async', 'true');
        } else {
          tag.setAttribute('rel', 'stylesheet');
          tag.setAttribute('href', url);
        }
        tag.addEventListener('load', () => resolve(), {once: true});
        tag.addEventListener(
          'error',
          () => reject(new Error(`Failed to load ${url}`)),
          {once: true}
        );
        document.head.appendChild(tag);
      })
    );
  }
  return loaders.get(url)!;
}

export default function StoryMapJS({
  data,
  options,
  height = 600,
}: {
  data: StoryMapData;
  options?: StoryMapOptions;
  height?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const elementId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const resolvedData = useMemo<StoryMapData>(() => {
    if (typeof data !== 'string') return data;
    return withBasePath(data);
  }, [data]);

  useEffect(() => {
    let storymap: {updateDisplay: () => void; destroy?: () => void} | null = null;
    const handleResize = () => storymap?.updateDisplay();

    const mount = async () => {
      await Promise.all([
        loadAsset('style', STORYMAP_STYLE),
        loadAsset('script', STORYMAP_SCRIPT),
      ]);

      const {KLStoryMap} = window as typeof window & {
        KLStoryMap?: KnightLabStoryMap;
      };
      if (!KLStoryMap || !containerRef.current) return;

      storymap = new KLStoryMap.StoryMap(elementId, resolvedData, options ?? {});
      window.addEventListener('resize', handleResize);
    };

    mount();

    return () => {
      window.removeEventListener('resize', handleResize);
      storymap?.destroy?.();
      storymap = null;
    };
  }, [resolvedData, options, elementId]);

  return (
    <div
      id={elementId}
      ref={containerRef}
      style={{
        width: '100%',
        height: typeof height === 'number' ? `${height}px` : height,
      }}
      data-canopy-storymap
    />
  );
}
