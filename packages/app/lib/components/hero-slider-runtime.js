// The hero carousel (`<Interstitials.Hero />`), after WAI-ARIA APG's "Carousel".
// Hand-rolled: it shows one slide at a time (the others `hidden`), so no slide off
// screen ever takes focus.
//
// Nothing in it moves on its own (WCAG 2.2.2 has nothing to pause): a slide changes
// only when the visitor moves it, by previous or next, a slide's button, or a swipe.
// The slides are polite (`aria-live`, Hero.jsx), so the slide a visitor moves to is
// announced.
//
// The server renders every slide and control (Hero.jsx), words from `locale.yml`
// included; this shows the controls and runs them.

const SWIPE_PX = 48;

function ready(fn) {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function initCarousel(host) {
  if (!host || host.__canopyHeroBound) return;
  host.__canopyHeroBound = true;
  const region = host.querySelector('[data-canopy-hero-carousel]');
  if (!region) return;
  const slides = Array.from(region.querySelectorAll('.canopy-interstitial__slide'));
  if (slides.length <= 1) return;

  const wrapper = region.querySelector('.canopy-interstitial__slide-wrapper');
  const nav = region.querySelector('.canopy-interstitial__nav');
  const prev = region.querySelector('.canopy-interstitial__nav-btn--prev');
  const next = region.querySelector('.canopy-interstitial__nav-btn--next');
  const pagination = region.querySelector('.canopy-interstitial__pagination');
  const dots = pagination
    ? Array.from(pagination.querySelectorAll('.canopy-interstitial__dot'))
    : [];

  let current = Math.max(
    0,
    slides.findIndex((slide) => !slide.hidden),
  );

  function preload(index) {
    const slide = slides[(index + slides.length) % slides.length];
    const image = slide && slide.querySelector('img[loading="lazy"]');
    if (image) image.loading = 'eager';
  }

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
    });
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle('canopy-interstitial__dot--active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
    preload(current + 1);
  }

  [nav, pagination].forEach((el) => {
    if (el) el.hidden = false;
  });

  if (prev) prev.addEventListener('click', () => show(current - 1));
  if (next) next.addEventListener('click', () => show(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => show(i)));

  // A swipe across the slide, by touch or pen, moves to the slide beside it. The
  // buttons are its single-pointer alternative (2.5.1, 2.5.7).
  let start = null;
  if (wrapper) {
    wrapper.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      start = { x: event.clientX, y: event.clientY };
    });
    wrapper.addEventListener('pointerup', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
      show(dx < 0 ? current + 1 : current - 1);
    });
    wrapper.addEventListener('pointercancel', () => {
      start = null;
    });
  }

  show(current);
}

function observeHosts() {
  try {
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes &&
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches && node.matches('[data-canopy-hero-slider]')) initCarousel(node);
            const inner = node.querySelectorAll
              ? node.querySelectorAll('[data-canopy-hero-slider]')
              : [];
            inner && inner.forEach && inner.forEach((el) => initCarousel(el));
          });
      });
    }).observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
    });
  } catch (_) {}
}

ready(() => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-canopy-hero-slider]').forEach((host) => initCarousel(host));
  observeHosts();
});
