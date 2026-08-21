/**
 * nav.js — Shared mobile hamburger nav for all inner pages.
 * Injects a hamburger button + full-screen overlay menu into .inner-nav
 */
(function () {
  'use strict';

  function initMobileNav() {
    const nav = document.querySelector('.inner-nav');
    if (!nav) return;

    /* ── Inject hamburger button ── */
    const hamburger = document.createElement('button');
    hamburger.id = 'nav-hamburger';
    hamburger.setAttribute('aria-label', 'Toggle menu');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = `
      <span class="ham-bar ham-bar-1"></span>
      <span class="ham-bar ham-bar-2"></span>
      <span class="ham-bar ham-bar-3"></span>
    `;
    nav.appendChild(hamburger);

    /* ── Inject mobile overlay ── */
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const links = [
      { href: 'index.html',   label: 'Home' },
      { href: 'product.html', label: 'Product' },
      { href: 'about.html',   label: 'About' },
      { href: 'work.html',    label: 'Work' },
      { href: 'contact.html', label: 'Contact' },
    ];

    const overlay = document.createElement('div');
    overlay.id = 'nav-overlay';
    overlay.innerHTML = `
      <div class="nav-overlay-inner">
        <nav class="nav-overlay-links">
          ${links.map(l => `
            <a href="${l.href}" class="nav-overlay-link${currentPage === l.href ? ' nav-overlay-link--active' : ''}">
              ${l.label}
            </a>
          `).join('')}
        </nav>
        <a href="contact.html" class="nav-overlay-cta">Get in Touch</a>
        <div class="nav-overlay-footer">
          <span>©2026 Zenrixa Limited</span>
          <span>Valletta, Malta</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    /* ── Toggle logic ── */
    let isOpen = false;

    function openMenu() {
      isOpen = true;
      overlay.classList.add('is-open');
      hamburger.classList.add('is-active');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      isOpen = false;
      overlay.classList.remove('is-open');
      hamburger.classList.remove('is-active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
      isOpen ? closeMenu() : openMenu();
    });

    /* Close when an overlay link is clicked */
    overlay.querySelectorAll('.nav-overlay-link, .nav-overlay-cta').forEach(el => {
      el.addEventListener('click', closeMenu);
    });

    /* Close on Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
