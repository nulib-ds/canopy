import EmblaCarousel from 'embla-carousel';

function ready(fn) {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function initSlider(host) {
  if (!host || host.__canopyHeroBound) return;
  const viewport = host.querySelector('.canopy-interstitial__slider');
  if (!viewport) return;

  const slides = Array.from(viewport.querySelectorAll('.canopy-interstitial__slide'));
  if (slides.length <= 1) {
    host.__canopyHeroBound = true;
    return;
  }

  const paginationEl = host.querySelector('.canopy-interstitial__pagination');
  const prevBtn = host.querySelector('.canopy-interstitial__nav-btn--prev');
  const nextBtn = host.querySelector('.canopy-interstitial__nav-btn--next');

  // Live region for screen-reader slide announcements
  const liveEl = document.createElement('div');
  liveEl.setAttribute('aria-live', 'polite');
  liveEl.setAttribute('aria-atomic', 'true');
  liveEl.className = 'canopy-interstitial__sr-live';
  host.appendChild(liveEl);

  const embla = EmblaCarousel(viewport, { loop: true, duration: 0 });

  const announce = (idx) => {
    liveEl.textContent = `Slide ${idx + 1} of ${slides.length}`;
  };

  if (paginationEl) {
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className =
        'canopy-interstitial__dot' +
        (i === 0 ? ' canopy-interstitial__dot--active' : '');
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => embla.scrollTo(i));
      paginationEl.appendChild(dot);
    });

    embla.on('select', () => {
      const idx = embla.selectedScrollSnap();
      announce(idx);
      paginationEl.querySelectorAll('.canopy-interstitial__dot').forEach((dot, i) => {
        const active = i === idx;
        dot.classList.toggle('canopy-interstitial__dot--active', active);
        dot.setAttribute('aria-current', active ? 'true' : 'false');
      });
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => embla.scrollPrev());
  if (nextBtn) nextBtn.addEventListener('click', () => embla.scrollNext());

  let timer = setInterval(() => embla.scrollNext(), 6000);
  const stopAutoplay = () => { clearInterval(timer); timer = null; };
  const startAutoplay = () => { if (!timer) timer = setInterval(() => embla.scrollNext(), 6000); };

  embla.on('pointerDown', stopAutoplay);
  embla.on('pointerUp', startAutoplay);

  host.__canopyHeroBound = true;
}

function observeHosts() {
  try {
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes &&
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches && node.matches('[data-canopy-hero-slider]'))
              initSlider(node);
            const inner = node.querySelectorAll
              ? node.querySelectorAll('[data-canopy-hero-slider]')
              : [];
            inner && inner.forEach && inner.forEach((el) => initSlider(el));
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
  document.querySelectorAll('[data-canopy-hero-slider]').forEach((host) => initSlider(host));
  observeHosts();
});
