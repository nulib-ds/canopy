const mdx = require('../../../packages/app/lib/build/mdx');
const { prepareAllRuntimes } = require('../../../packages/app/lib/build/runtimes');

const runtimeNames = [
  ['Clover hydration', 'ensureClientRuntime'],
  ['Custom client component', 'ensureCustomClientRuntime'],
  ['Timeline', 'ensureTimelineRuntime'],
  ['Map', 'ensureMapRuntime'],
  ['Hero', 'ensureHeroRuntime'],
  ['RelatedItems', 'ensureFacetsRuntime'],
  ['React globals', 'ensureReactGlobals'],
];

afterEach(() => jest.restoreAllMocks());

test.each(runtimeNames)(
  '%s runtime failures reject preparation with the original cause',
  async (label, method) => {
    for (const [, name] of runtimeNames) {
      jest.spyOn(mdx, name).mockResolvedValue(undefined);
    }
    const error = new Error('Could not resolve dependency');
    mdx[method].mockRejectedValue(error);
    await expect(prepareAllRuntimes()).rejects.toMatchObject({
      message: `[canopy] ${label} runtime failed to build: ${error.message}`,
      cause: error,
    });
  },
);
