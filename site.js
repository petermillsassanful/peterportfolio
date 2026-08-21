/**
 * site.js — Phase 2 shared utilities
 *  1. Page transitions (fade-out on exit, fade-in on load)
 *  2. Back-to-top button
 *  3. Custom cursor dot + ring
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     1. PAGE TRANSITIONS
     Fade the body in on load; fade out before navigating away.
     Skips index.html (it has its own loader animation).
     ═══════════════════════════════════════════════════════════ */
  (function initTransitions() {
    const hasLoader = !!document.getElementById('loader');

    /* Fade in — skip if index loader is present */
    if (!hasLoader) {
      document.body.style.opacity = '0';
      document.body.style.transition = 'opacity 0.38s ease';
      /* Use rAF so the initial opacity:0 is painted before we remove it */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.style.opacity = '1';
        });
      });
    }

    /* Intercept internal link clicks and fade out first */
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');

      /* Skip: anchors, external, mailto, tel, _blank */
      if (!href) return;
      if (href.startsWith('#'))        return;
      if (href.startsWith('http'))     return;
      if (href.startsWith('mailto'))   return;
      if (href.startsWith('tel'))      return;
      if (link.target === '_blank')    return;

      /* Skip if modifier keys held (open in new tab gesture) */
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;

      e.preventDefault();

      document.body.style.transition = 'opacity 0.22s ease';
      document.body.style.opacity    = '0';

      setTimeout(function () {
        window.location.href = href;
      }, 220);
    });
  })();


  /* ═══════════════════════════════════════════════════════════
     2. BACK TO TOP BUTTON
     Appears after scrolling 500px; smooth-scrolls back to top.
     ═══════════════════════════════════════════════════════════ */
  (function initBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="18 15 12 9 6 15"/>' +
      '</svg>';
    document.body.appendChild(btn);

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          if (window.scrollY > 500) {
            btn.classList.add('is-visible');
          } else {
            btn.classList.remove('is-visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();


  /* ═══════════════════════════════════════════════════════════
     3. CUSTOM CURSOR
     Dot  → instant JS position via translate3d (GPU layer).
     Ring → CSS transition only — zero JS rAF, compositor-thread.
     Only active on fine-pointer (mouse) devices.
     ═══════════════════════════════════════════════════════════ */
  (function initCursor() {
    if (!window.matchMedia('(pointer: fine)').matches) return;

    var dot  = document.createElement('div');
    var ring = document.createElement('div');
    dot.id  = 'cursor-dot';
    ring.id = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var visible = false;

    document.addEventListener('mousemove', function (e) {
      var x = e.clientX;
      var y = e.clientY;
      /* translate3d forces GPU compositing — no layout, no paint */
      dot.style.transform  = 'translate3d(' + (x - 4)  + 'px,' + (y - 4)  + 'px,0)';
      ring.style.transform = 'translate3d(' + (x - 20) + 'px,' + (y - 20) + 'px,0)';
      if (!visible) {
        dot.classList.add('is-visible');
        ring.classList.add('is-visible');
        visible = true;
      }
    }, { passive: true });

    document.addEventListener('mouseover', function (e) {
      if (e.target.closest('a, button, [role="button"], input, textarea, select, label')) {
        ring.classList.add('is-hovering');
        dot.classList.add('is-hovering');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest('a, button, [role="button"], input, textarea, select, label')) {
        ring.classList.remove('is-hovering');
        dot.classList.remove('is-hovering');
      }
    });

    document.addEventListener('mouseleave', function () {
      dot.classList.remove('is-visible');
      ring.classList.remove('is-visible');
      visible = false;
    });
    document.addEventListener('mouseenter', function () {
      dot.classList.add('is-visible');
      ring.classList.add('is-visible');
      visible = true;
    });

    document.documentElement.classList.add('custom-cursor-active');
  })();

})();
