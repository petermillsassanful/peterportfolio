(function () {
  /* ─── Device & Performance Configuration ────────────────── */
  const isMobile = (window.innerWidth < 768) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const DPR_CAP = isMobile ? 1.5 : 2;
  const LERP_FACTOR = isMobile ? 0.22 : 0.16;

  /* On mobile, subsample frames to stay well under the 300MB iOS WebKit memory limit.
     Desktop uses 100% full frame fidelity (120 + 200 = 320 frames).
     Mobile steps by 3 (40 + 66 = 106 frames) saving ~80% memory while looking silky smooth. */
  const STEP_1 = isMobile ? 3 : 1;
  const STEP_2 = isMobile ? 3 : 1;

  const TOTAL_FRAMES_1 = 120;
  const TOTAL_FRAMES_2 = 200;
  const PRIORITY_FRAMES_1 = isMobile ? 6 : 15;

  /* ─── DOM References ────────────────────────────────────── */
  const section1 = document.getElementById('section-1');
  const canvas1  = document.getElementById('canvas-1');
  const ctx1     = canvas1.getContext('2d');

  const section3 = document.getElementById('section-3');
  const canvas2  = document.getElementById('canvas-2');
  const ctx2     = canvas2.getContext('2d');

  const loader     = document.getElementById('loader');
  const loaderText = document.getElementById('loader-text');
  const loaderFill = document.getElementById('loader-fill');

  const orangeBlobInner = document.getElementById('orange-blob-inner');

  /* ─── Frame Storage ──────────────────────────────────────── */
  const frames1 = new Array(TOTAL_FRAMES_1);
  const ready1  = new Uint8Array(TOTAL_FRAMES_1);
  const frames2 = new Array(TOTAL_FRAMES_2);
  const ready2  = new Uint8Array(TOTAL_FRAMES_2);

  let targetProgress1 = 0, currentProgress1 = 0;
  let targetProgress2 = 0, currentProgress2 = 0;

  /* ─── Image Loading & Decoding ──────────────────────────── */

  function framePath(folder, index) {
    const num = String(index + 1).padStart(3, '0');
    return `${folder}/ezgif-frame-${num}.webp`;
  }

  /* On mobile WebKit, createImageBitmap creates non-reclaimable GPU allocations
     that trigger iOS jetsam OOM crashes. On mobile, we use standard HTMLImageElement
     which the browser's compositor pages in/out dynamically. On desktop, we leverage
     createImageBitmap for zero-jank background thread decode. */
  function loadAndDecode(src, frameArr, readyArr, index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (!isMobile && ('createImageBitmap' in window)) {
          createImageBitmap(img)
            .then((bm) => {
              frameArr[index] = bm;
              readyArr[index] = 1;
              scheduleRender();
              resolve();
            })
            .catch(() => {
              frameArr[index] = img;
              readyArr[index] = 1;
              scheduleRender();
              resolve();
            });
        } else {
          frameArr[index] = img;
          readyArr[index] = 1;
          scheduleRender();
          resolve();
        }
      };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  /* Concurrently load frames in controlled batches to avoid saturating network & CPU */
  async function loadFramesInBatches(indices, folder, frameArr, readyArr, batchSize = 6) {
    for (let i = 0; i < indices.length; i += batchSize) {
      const chunk = indices.slice(i, i + batchSize);
      await Promise.all(chunk.map((idx) => loadAndDecode(framePath(folder, idx), frameArr, readyArr, idx)));
    }
  }

  /* Initial Priority Load: Just enough frames to render Section 1 and first frame of Section 3 */
  async function loadPriorityFrames() {
    let loaded = 0;
    const initialIndices1 = [];
    for (let i = 0; i < PRIORITY_FRAMES_1; i += STEP_1) {
      initialIndices1.push(i);
    }
    // Also include index 0 for Section 3 so it's never blank
    const totalPriorityCount = initialIndices1.length + 1;

    const promises = initialIndices1.map((idx) =>
      loadAndDecode(framePath('images', idx), frames1, ready1, idx).then(() => {
        loaded++;
        const pct = Math.floor((loaded / totalPriorityCount) * 100);
        if (loaderText) loaderText.textContent = `Loading ${pct}%`;
        if (loaderFill) loaderFill.style.width = `${pct}%`;
      })
    );

    promises.push(
      loadAndDecode(framePath('images2', 0), frames2, ready2, 0).then(() => {
        loaded++;
        const pct = Math.floor((loaded / totalPriorityCount) * 100);
        if (loaderText) loaderText.textContent = `Loading ${pct}%`;
        if (loaderFill) loaderFill.style.width = `${pct}%`;
      })
    );

    await Promise.all(promises);
  }

  /* Load remaining Section 1 frames gently in background */
  function loadRemainingSection1() {
    const remainingIndices = [];
    for (let i = PRIORITY_FRAMES_1; i < TOTAL_FRAMES_1; i += STEP_1) {
      if (!ready1[i]) remainingIndices.push(i);
    }
    loadFramesInBatches(remainingIndices, 'images', frames1, ready1, isMobile ? 4 : 8);
  }

  /* Section 3 Lazy Loader: Only loads when the user scrolls towards Section 3 */
  let s3LoadStarted = false;
  function startLoadingSection3() {
    if (s3LoadStarted) return;
    s3LoadStarted = true;

    const s3Indices = [];
    for (let i = 0; i < TOTAL_FRAMES_2; i += STEP_2) {
      if (!ready2[i]) s3Indices.push(i);
    }
    loadFramesInBatches(s3Indices, 'images2', frames2, ready2, isMobile ? 4 : 8);
  }

  function initSection3LazyTrigger() {
    const triggerEl = document.getElementById('section-plain-black') || document.getElementById('section-testimonials');
    if ('IntersectionObserver' in window && triggerEl) {
      const obs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          startLoadingSection3();
          obs.disconnect();
        }
      }, { rootMargin: '400px 0px' });
      obs.observe(triggerEl);
    } else {
      setTimeout(startLoadingSection3, 1500);
    }
  }

  async function boot() {
    await loadPriorityFrames();
    onReady();
    loadRemainingSection1();
    initSection3LazyTrigger();
  }

  function onReady() {
    if (loader) {
      loader.classList.add('hidden-loader');
      setTimeout(() => { loader.style.display = 'none'; }, 400);
    }
    resizeCanvases();
    scheduleRender();
  }

  /* ─── High-DPI Canvas Sizing & Layout ─────────────────── */

  let canvasWidth  = 0;
  let canvasHeight = 0;
  let dpr = 1;

  function resizeCanvases() {
    /* Cap DPR to 1.5 on mobile and 2 on desktop to prevent mobile GPU OOM crashes */
    dpr          = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvasWidth  = window.innerWidth;
    canvasHeight = window.innerHeight;

    [{ canvas: canvas1, ctx: ctx1 },
     { canvas: canvas2, ctx: ctx2 }].forEach((item) => {
      item.canvas.width  = Math.round(canvasWidth  * dpr);
      item.canvas.height = Math.round(canvasHeight * dpr);
      item.ctx.setTransform(1, 0, 0, 1, 0, 0);
      item.ctx.scale(dpr, dpr);
      item.ctx.imageSmoothingEnabled = true;
      item.ctx.imageSmoothingQuality = 'high';
    });

    lastFrame1 = -1;
    lastFrame2 = -1;
    updateTargetProgress();
    scheduleRender();
  }

  /* ─── Rendering Engine ──────────────────────────────────── */

  function getWatermarkGradient(ctx) {
    const cx = canvasWidth  - 35;
    const cy = canvasHeight - 20;
    const r  = 110;
    const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0,    'rgba(0,0,0,0.9)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    return g;
  }

  function paintToCanvas(ctx, frame) {
    const fw = frame.naturalWidth  !== undefined ? frame.naturalWidth  : frame.width;
    const fh = frame.naturalHeight !== undefined ? frame.naturalHeight : frame.height;
    if (!fw || !fh) return;

    const imgRatio    = fw / fh;
    const canvasRatio = canvasWidth / canvasHeight;
    const overscan    = 1.03;
    let drawW, drawH;

    if (canvasRatio > imgRatio) {
      drawW = canvasWidth  * overscan;
      drawH = (canvasWidth / imgRatio) * overscan;
    } else {
      drawH = canvasHeight * overscan;
      drawW = (canvasHeight * imgRatio) * overscan;
    }

    const x = (canvasWidth  - drawW) / 2;
    const y = (canvasHeight - drawH) / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(frame, x, y, drawW, drawH);

    try {
      const grad = getWatermarkGradient(ctx);
      const r = 110;
      ctx.fillStyle = grad;
      ctx.fillRect(canvasWidth - r * 1.6, canvasHeight - r * 1.6, r * 1.6, r * 1.6);
    } catch (e) {
      // Ignore watermark gradient if context restriction occurs
    }
  }

  function smartDraw(ctx, frameArr, readyArr, targetIdx, lastIdx) {
    if (readyArr[targetIdx]) {
      if (targetIdx === lastIdx) return lastIdx;
      paintToCanvas(ctx, frameArr[targetIdx]);
      return targetIdx;
    }
    // Search backwards for the nearest decoded frame
    for (let i = targetIdx - 1; i >= 0; i--) {
      if (readyArr[i]) {
        if (i === lastIdx) return lastIdx;
        paintToCanvas(ctx, frameArr[i]);
        return i;
      }
    }
    // If none found backwards, search forwards so canvas is NEVER blank
    for (let i = targetIdx + 1; i < readyArr.length; i++) {
      if (readyArr[i]) {
        if (i === lastIdx) return lastIdx;
        paintToCanvas(ctx, frameArr[i]);
        return i;
      }
    }
    return lastIdx;
  }

  /* ─── Scroll Progress (Dynamic & Precise) ───────────────── */

  function updateTargetProgress() {
    const vh = window.innerHeight;

    const rect1 = section1.getBoundingClientRect();
    const s1 = Math.max(1, section1.offsetHeight - vh);
    targetProgress1 = Math.max(0, Math.min(1, -rect1.top / s1));

    const rect3 = section3.getBoundingClientRect();
    const s3 = Math.max(1, section3.offsetHeight - vh);
    targetProgress2 = Math.max(0, Math.min(1, -rect3.top / s3));
  }

  /* ─── On-Demand Render Loop ──────────────────────────────── */

  let lastFrame1 = -1;
  let lastFrame2 = -1;
  let rafId = null;

  function scheduleRender() {
    if (!rafId) rafId = requestAnimationFrame(renderLoop);
  }

  function renderLoop() {
    rafId = null;

    currentProgress1 += (targetProgress1 - currentProgress1) * LERP_FACTOR;
    currentProgress2 += (targetProgress2 - currentProgress2) * LERP_FACTOR;

    const converged1 = Math.abs(targetProgress1 - currentProgress1) < 0.0001;
    const converged2 = Math.abs(targetProgress2 - currentProgress2) < 0.0001;
    if (converged1) currentProgress1 = targetProgress1;
    if (converged2) currentProgress2 = targetProgress2;

    const targetFrame1 = Math.min(TOTAL_FRAMES_1 - 1, Math.floor(currentProgress1 * (TOTAL_FRAMES_1 - 1)));
    const targetFrame2 = Math.min(TOTAL_FRAMES_2 - 1, Math.floor(currentProgress2 * (TOTAL_FRAMES_2 - 1)));

    lastFrame1 = smartDraw(ctx1, frames1, ready1, targetFrame1, lastFrame1);
    lastFrame2 = smartDraw(ctx2, frames2, ready2, targetFrame2, lastFrame2);

    updateS3Chapters(currentProgress2);

    if (orangeBlobInner) {
      const scale  = 1 + currentProgress1 * 0.9;
      const driftX = currentProgress1 * 6 - 3;
      const driftY = currentProgress1 * -8;
      orangeBlobInner.style.transform =
        `translate(-50%,-50%) translate(${driftX}%,${driftY}%) scale(${scale})`;
      orangeBlobInner.style.opacity = String(0.55 + currentProgress1 * 0.35);
    }

    if (!converged1 || !converged2) {
      rafId = requestAnimationFrame(renderLoop);
    }
  }

  /* ─── Mobile Menu ────────────────────────────────────────── */

  const mobileMenu         = document.getElementById('mobile-menu');
  const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');
  const btnOpenMenu        = document.getElementById('btn-open-menu');
  const btnCloseMenu       = document.getElementById('btn-close-menu');
  const mobileNavLinks     = document.querySelectorAll('.mobile-nav-link');

  function openMenu() {
    mobileMenu.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (btnOpenMenu)        btnOpenMenu.addEventListener('click', openMenu);
  if (btnCloseMenu)       btnCloseMenu.addEventListener('click', closeMenu);
  if (mobileMenuBackdrop) mobileMenuBackdrop.addEventListener('click', closeMenu);

  mobileNavLinks.forEach((link) => {
    link.addEventListener('click', () => { closeMenu(); });
  });

  /* ─── Chat Modal ────────────────────────────────────────── */

  const chatModal    = document.getElementById('chat-modal');
  const btnOpenChat  = document.getElementById('btn-open-chat');
  const btnCloseChat = document.getElementById('btn-close-chat');
  const chatThread   = document.getElementById('chat-thread');
  const chatInput    = document.getElementById('chat-input');
  const chatSend     = document.getElementById('chat-send');

  const STUDIO_RESPONSES = [
    "Thanks for reaching out! One of our design partners here in Valletta will review this and reply directly today.",
    "Great question. We engineer spatial interfaces and real-time 3D pipelines from scratch. Drop your email and we'll send our latest case studies and technical breakdown.",
    "We'd love to collaborate on this. If you share your project timeline or rough scope, Alex or Sara from our founding team will reply within a couple of hours.",
    "Got your note! Whether you're exploring the Zenrixa Vision headset platform or commissioning custom XR work, leave your email and we'll follow up directly.",
  ];

  function openModal() {
    chatModal.classList.remove('opacity-0', 'pointer-events-none');
    chatModal.classList.add('opacity-100', 'pointer-events-auto');
    chatInput.focus();
  }

  function closeModal() {
    chatModal.classList.remove('opacity-100', 'pointer-events-auto');
    chatModal.classList.add('opacity-0', 'pointer-events-none');
  }

  function scrollThread() {
    chatThread.scrollTop = chatThread.scrollHeight;
  }

  function appendBubble(text, role) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble--${role}`;
    bubble.textContent = text;
    chatThread.appendChild(bubble);
    requestAnimationFrame(() => bubble.classList.add('is-visible'));
    scrollThread();
    return bubble;
  }

  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'chat-bubble chat-bubble--studio chat-typing';
    indicator.id = 'chat-typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    chatThread.appendChild(indicator);
    requestAnimationFrame(() => indicator.classList.add('is-visible'));
    scrollThread();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('chat-typing-indicator');
    if (el) el.remove();
  }

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    chatSend.disabled = true;
    appendBubble(text, 'user');
    setTimeout(() => {
      showTypingIndicator();
      setTimeout(() => {
        removeTypingIndicator();
        const reply = STUDIO_RESPONSES[Math.floor(Math.random() * STUDIO_RESPONSES.length)];
        appendBubble(reply, 'studio');
        chatSend.disabled = false;
        chatInput.focus();
      }, 1200);
    }, 300);
  }

  if (btnOpenChat)  btnOpenChat.addEventListener('click', openModal);
  if (btnCloseChat) btnCloseChat.addEventListener('click', closeModal);
  if (chatSend)     chatSend.addEventListener('click', sendMessage);
  if (chatInput)    chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  chatModal.addEventListener('click', (e) => {
    if (e.target === chatModal) closeModal();
  });

  /* ─── IntersectionObserver: Feature Card Reveal ─────────── */

  const revealCards = document.querySelectorAll('[data-reveal]');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealCards.forEach((card) => revealObserver.observe(card));
  } else {
    revealCards.forEach((card) => card.classList.add('is-revealed'));
  }

  /* ─── Event Listeners ───────────────────────────────────── */

  window.addEventListener('resize', resizeCanvases, { passive: true });

  const scrollIndicator     = document.getElementById('scroll-indicator');
  let   scrollIndicatorHidden = false;

  window.addEventListener('scroll', () => {
    updateTargetProgress();
    scheduleRender();
    if (!scrollIndicatorHidden && window.scrollY > 40) {
      scrollIndicator.classList.add('is-hidden');
      scrollIndicatorHidden = true;
    }
  }, { passive: true });

  /* ─── Section 3 Chapter Scroll Driver ───────────────────── */
  //
  // The 400vh section-3 scroll range (progress 0→1) is split into
  // three chapters. Each chapter has an enter/exit window. Within
  // that window the panel's opacity and translateY are interpolated.
  //
  // Chapter 1 (Hero):    0.00 → 0.28   (enter 0.00, exit 0.22, gone 0.28)
  // Chapter 2 (Metrics): 0.24 → 0.58   (enter 0.24, exit 0.50, gone 0.58)
  // Chapter 3 (Cards):   0.54 → 1.00   (enter 0.54, exit 0.88, gone 1.00)

  const s3PanelHero    = document.getElementById('s3-panel-hero');
  const s3PanelMetrics = document.getElementById('s3-panel-metrics');
  const s3PanelCards   = document.getElementById('s3-panel-cards');

  const S3_CHAPTERS = [
    { el: s3PanelHero,    enterStart: 0.00, enterEnd: 0.08, exitStart: 0.22, exitEnd: 0.30 },
    { el: s3PanelMetrics, enterStart: 0.24, enterEnd: 0.32, exitStart: 0.50, exitEnd: 0.58 },
    { el: s3PanelCards,   enterStart: 0.54, enterEnd: 0.64, exitStart: 0.88, exitEnd: 0.98 },
  ];

  // Lerp utility
  function lerp01(a, b, t) {
    return Math.max(0, Math.min(1, (t - a) / (b - a)));
  }

  function updateS3Chapters(progress) {
    S3_CHAPTERS.forEach((ch) => {
      if (!ch.el) return;

      // Opacity: ramps up during enter, holds at 1, ramps down during exit
      const opIn  = lerp01(ch.enterStart, ch.enterEnd, progress);
      const opOut = 1 - lerp01(ch.exitStart, ch.exitEnd, progress);
      const op    = Math.min(opIn, opOut);

      // translateY: slides up 40px → 0 on enter, 0 → -30px on exit
      let ty = 0;
      if (progress < ch.enterEnd) {
        ty = (1 - lerp01(ch.enterStart, ch.enterEnd, progress)) * 40;
      } else if (progress > ch.exitStart) {
        ty = lerp01(ch.exitStart, ch.exitEnd, progress) * -30;
      }

      ch.el.style.setProperty('--s3-panel-opacity', op.toFixed(4));
      ch.el.style.setProperty('--s3-panel-y',       `${ty.toFixed(2)}px`);

      // Toggle pointer-events so inactive panels don't block clicks
      const isVisible = op > 0.05;
      ch.el.classList.toggle('s3-active', isVisible);
      ch.el.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    });
  }

  /* ─── Pricing Billing Toggle ────────────────────────────── */

  const btnMonthly   = document.getElementById('toggle-monthly');
  const btnAnnual    = document.getElementById('toggle-annual');
  const priceTags    = document.querySelectorAll('.pricing-price');

  function setPricing(cycle) {
    // Swap active state on toggle buttons
    if (cycle === 'monthly') {
      btnMonthly.classList.add('billing-btn--active');
      btnAnnual.classList.remove('billing-btn--active');
      btnMonthly.setAttribute('aria-pressed', 'true');
      btnAnnual.setAttribute('aria-pressed', 'false');
    } else {
      btnAnnual.classList.add('billing-btn--active');
      btnMonthly.classList.remove('billing-btn--active');
      btnAnnual.setAttribute('aria-pressed', 'true');
      btnMonthly.setAttribute('aria-pressed', 'false');
    }
    // Update displayed prices from data attributes
    priceTags.forEach((el) => {
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = el.dataset[cycle] || el.dataset.monthly;
        el.style.opacity = '1';
      }, 150);
    });
  }

  if (btnMonthly) btnMonthly.addEventListener('click', () => setPricing('monthly'));
  if (btnAnnual)  btnAnnual.addEventListener('click',  () => setPricing('annual'));

  /* ─── Section-3 Metrics Counter Trigger ─────────────────── */
  /* Because #section-3 uses position:sticky its children are always
     "intersecting" from the observer's perspective. We fire the counters
     once via a dedicated scroll listener the moment the section enters view. */
  let s3CountersFired = false;
  function maybeFireS3Counters() {
    if (s3CountersFired) return;
    const rect = section3.getBoundingClientRect();
    // Section is in view when its top is above the bottom of the viewport
    if (rect.top < window.innerHeight * 0.85) {
      s3CountersFired = true;
      window.removeEventListener('scroll', maybeFireS3Counters);

      // Re-use the same animateCount function defined in the counter block below
      // Use a small delay so the sticky panel has fully snapped into place
      setTimeout(() => {
        section3.querySelectorAll('[data-count]').forEach((el) => {
          const count    = parseFloat((el.dataset.count    || '0').replace(/[^\d.]/g, ''));
          const prefix   = el.dataset.prefix   || '';
          const suffix   = el.dataset.suffix   || '';
          const scale    = el.dataset.scale    ? parseInt(el.dataset.scale, 10)    : 0;
          const duration = el.dataset.duration ? parseInt(el.dataset.duration, 10) : 1800;
          if (!isNaN(count)) animateCount(el, count, prefix, suffix, duration, scale);
        });
      }, 200);
    }
  }
  window.addEventListener('scroll', maybeFireS3Counters, { passive: true });
  // Also check immediately in case the page loads mid-scroll
  maybeFireS3Counters();

  /* ─── Start ─────────────────────────────────────────────── */
  boot();
})();

/* ═══════════════════════════════════════════════════════════
   COUNTING ANIMATION UTILITY
   Handles [data-count] elements across all pages.

   Attributes:
     data-count="380"      — target number
     data-prefix="$"       — optional prefix (e.g. "$")
     data-suffix="+"       — optional suffix (e.g. "+", "k+", "ms", "°")
     data-scale="1000"     — optional divisor (e.g. 3000 → "3k+")
     data-duration="1800"  — animation duration in ms (default 1800)
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Easing: easeOutExpo — fast start, graceful deceleration */
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  /* Format the animated value */
  function fmt(v, scale, suffix) {
    if (scale) {
      /* e.g. v=2400, scale=1000, suffix="k+" → "2k+" → final "3k+" */
      return Math.round(v / scale) + suffix;
    }
    if (v >= 1000) {
      return Math.round(v).toLocaleString() + suffix;
    }
    return Math.round(v) + suffix;
  }

  /**
   * Animate a single counter element.
   */
  function animateCount(el, target, prefix, suffix, duration, scale) {
    const start = performance.now();

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = easeOutExpo(progress);
      const current  = eased * target;

      el.textContent = prefix + fmt(current, scale, suffix);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        /* Snap to exact final value */
        el.textContent = prefix + fmt(target, scale, suffix);
      }
    }

    requestAnimationFrame(step);
  }

  /* Observe all [data-count] elements and fire once on entry */
  function initCounters() {
    const targets = document.querySelectorAll('[data-count]');
    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        const el       = entry.target;
        const count    = parseFloat((el.dataset.count    || '0').replace(/[^\d.]/g, ''));
        const prefix   = el.dataset.prefix   || '';
        const suffix   = el.dataset.suffix   || '';
        const scale    = el.dataset.scale    ? parseInt(el.dataset.scale, 10)    : 0;
        const duration = el.dataset.duration ? parseInt(el.dataset.duration, 10) : 1800;

        if (!isNaN(count)) {
          animateCount(el, count, prefix, suffix, duration, scale);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    targets.forEach((el) => observer.observe(el));
  }

  /* Run on DOMContentLoaded or immediately if already loaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCounters);
  } else {
    initCounters();
  }
})();

