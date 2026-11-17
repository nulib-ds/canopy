// The hero carousel (`<Interstitials.Hero />`), after WAI-ARIA APG's "Auto-Rotating
// Image Carousel". Hand-rolled: it shows one slide at a time (the others `hidden`),
// so no slide off screen ever takes focus, and nothing moves but the slide shown.
//
// WCAG 2.2.2 (packages/app/DESIGN.md §0, "Nothing moves on its own without a pause"):
// - the rotation control is first in the carousel's reading order;
// - rotation holds while the pointer is over the carousel, and stops for good when
//   keyboard focus enters it, or the visitor uses any of its controls or swipes;
// - it never starts under `prefers-reduced-motion: reduce`;
// - rotation is never announced (`aria-live="off"`); once stopped, the slides are
//   polite, so a slide the visitor moves to is announced.
//
// The server renders every slide and control (Hero.jsx), words from `locale.yml`
// included; this shows the controls and runs them.

const ROTATE_MS = 6000;
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
  const rotation = region.querySelector('.canopy-interstitial__rotation');
  const nav = region.querySelector('.canopy-interstitial__nav');
  const prev = region.querySelector('.canopy-interstitial__nav-btn--prev');
  const next = region.querySelector('.canopy-interstitial__nav-btn--next');
  const pagination = region.querySelector('.canopy-interstitial__pagination');
  const dots = pagination
    ? Array.from(pagination.querySelectorAll('.canopy-interstitial__dot'))
    : [];

  const reduceMotion =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  let current = Math.max(
    0,
    slides.findIndex((slide) => !slide.hidden),
  );
  // Stopped for good: by the rotation control, any other control, keyboard focus, or
  // the visitor's motion preference. Held: while the pointer is over the carousel.
  let stopped = Boolean(reduceMotion && reduceMotion.matches);
  let held = false;
  let timer = null;

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

  function rotating() {
    return !stopped && !held;
  }

  function update() {
    if (wrapper) wrapper.setAttribute('aria-live', stopped ? 'polite' : 'off');
    if (rotation) {
      const label = stopped
        ? rotation.getAttribute('data-label-start')
        : rotation.getAttribute('data-label-stop');
      if (label) rotation.setAttribute('aria-label', label);
      rotation.setAttribute('data-rotation', stopped ? 'off' : 'on');
    }
    clearTimeout(timer);
    timer = null;
    if (rotating()) {
      timer = setTimeout(() => {
        show(current + 1);
        update();
      }, ROTATE_MS);
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    update();
  }

  // A visitor's move: rotation stops for good, then the slide changes, so the slides
  // are already polite when it does and the new one is announced.
  function go(index) {
    stop();
    show(index);
  }

  [rotation, nav, pagination].forEach((el) => {
    if (el) el.hidden = false;
  });

  if (rotation) {
    rotation.addEventListener('click', () => {
      stopped = !stopped;
      // Started from its own control, rotation runs even with the pointer still on it.
      if (!stopped) held = false;
      update();
    });
  }
  if (prev) prev.addEventListener('click', () => go(current - 1));
  if (next) next.addEventListener('click', () => go(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)));

  region.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    held = true;
    update();
  });
  region.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'mouse') return;
    held = false;
    update();
  });

  // Keyboard focus stops it for good; a click's focus does not, so a pointer can still
  // start and pause it with its own control.
  region.addEventListener('focusin', (event) => {
    const target = event.target;
    let visible = true;
    try {
      visible = target.matches(':focus-visible');
    } catch (_) {}
    if (visible) stop();
  });

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
      go(dx < 0 ? current + 1 : current - 1);
    });
    wrapper.addEventListener('pointercancel', () => {
      start = null;
    });
  }

  if (reduceMotion) {
    const onChange = () => {
      if (reduceMotion.matches) stop();
    };
    if (typeof reduceMotion.addEventListener === 'function') {
      reduceMotion.addEventListener('change', onChange);
    } else if (typeof reduceMotion.addListener === 'function') {
      reduceMotion.addListener(onChange);
    }
  }

  show(current);
  update();
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
