/**
 * author-card-core.js
 * Shared author card widget used by the prototype (author-popup.js)
 * and embedded verbatim in the injector (author-card-injector.js).
 *
 * Usage:
 *   const widget = AuthorCardWidget({
 *     populateCard(trigger, card) { … },   // required – fill card DOM synchronously
 *     afterShow(trigger)          { … },   // optional – called after hover card appears
 *     afterOpen(trigger)          { … },   // optional – called after persistent card opens
 *                                          //            also called when navigating authors
 *   });
 *   widget.repopulate(trigger);            // re-fill card if trigger is still current
 *
 * ⚠ The body of AuthorCardWidget() is copy-pasted into author-card-injector.js.
 *   Edit this file first, then update section ⑤ in the injector.
 */
window.AuthorCardWidget = function AuthorCardWidget(options) {
  'use strict';

  const TRIGGER_SEL = '.author-trigger';
  const CARD_ID     = 'author-card';
  const MOBILE_BP   = 720;   /* px – below this width, tap opens modal dialog */
  const HIDE_DELAY  = 150;   /* ms – grace period before hover card hides */
  const POPUP_GAP   = 10;    /* px – gap between trigger and tooltip */
  const ARROW_OFF   = 24;    /* px – arrow offset from card's left edge */

  const onPopulate = options.populateCard;
  const afterShow  = options.afterShow || function () {};
  const afterOpen  = options.afterOpen || function () {};

  let card         = null;
  let hideTimer    = null;
  let cardTrigger  = null;   /* trigger that opened the card (for focus-return) */
  let persistent   = false;  /* true = tap/mobile mode; false = hover mode */
  let triggerList  = [];     /* ordered list of all .author-trigger elements */
  let currentIndex = -1;     /* index of cardTrigger in triggerList */


  /* ════════════════════════════════════════════════════════════
     Card DOM
     ════════════════════════════════════════════════════════════ */

  function createCard() {
    card = document.createElement('dialog');
    card.id = CARD_ID;
    card.setAttribute('role', 'tooltip');
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `
      <div class="author-card__header">
        <img class="author-card__photo" src="" alt="" width="64" height="64">
        <div class="author-card__summary">
          <a class="author-card__name-link" href="#" target="_blank" rel="noopener"></a>
          <span class="author-card__role"></span>
          <div class="author-card__actions">
            <a class="author-card__follow" href="#" target="_blank" rel="noopener">
              <span aria-hidden="true">+</span> Folgen
            </a>
            <a class="author-card__profile-link" href="#" target="_blank" rel="noopener">
              Profil
            </a>
          </div>
        </div>
        <button class="author-card__close" aria-label="Schlie\xdfen" type="button">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" stroke-width="1.6"
                  stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="author-card__body">
        <p class="author-card__bio"></p>
      </div>
      <div class="author-card__nav" aria-label="Zwischen Autoren wechseln">
        <div class="author-card__nav-slider"></div>
      </div>
    `;
    document.body.appendChild(card);
  }

  function fillCard(trigger) {
    onPopulate(trigger, card);
    card.querySelector('.author-card__body').scrollTop = 0;
  }

  function cardIsVisible() { return card.classList.contains('is-visible'); }
  function isMobile()      { return window.innerWidth < MOBILE_BP; }


  /* ════════════════════════════════════════════════════════════
     Author navigation (modal mode only)
     ════════════════════════════════════════════════════════════ */

  function collectTriggers() {
    triggerList = Array.from(document.querySelectorAll(TRIGGER_SEL));
  }

  function updateNav(index) {
    const nav    = card.querySelector('.author-card__nav');
    const slider = card.querySelector('.author-card__nav-slider');
    if (!slider) return;
    if (nav) nav.style.display = triggerList.length <= 1 ? 'none' : '';
    if (slider.children.length !== triggerList.length) {
      slider.innerHTML = '';
      triggerList.forEach(function (trigger, i) {
        const name = trigger.dataset.authorName || trigger.textContent.trim();
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'author-card__nav-btn';
        btn.dataset.navIndex = i;
        btn.textContent = name;
        slider.appendChild(btn);
      });
    }
    Array.from(slider.children).forEach(function (btn, i) {
      btn.classList.toggle('author-card__nav-btn--active', i === index);
    });
    const activeBtn = slider.children[index];
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function navigateTo(index) {
    if (index < 0 || index >= triggerList.length) return;
    currentIndex = index;
    cardTrigger  = triggerList[index];
    fillCard(cardTrigger);
    updateNav(index);
    afterOpen(cardTrigger);   /* triggers ensureData in the injector */
  }


  /* ════════════════════════════════════════════════════════════
     Positioning (desktop tooltip only)
     Both elements are position:fixed – getBoundingClientRect() gives viewport coords.
     ════════════════════════════════════════════════════════════ */

  function positionEl(el, trigger) {
    const rect = trigger.getBoundingClientRect();
    const elH  = el.offsetHeight;
    const elW  = el.offsetWidth || 360;
    const vp   = { w: window.innerWidth, h: window.innerHeight };

    const spaceAbove = rect.top;
    const spaceBelow = vp.h - rect.bottom;
    const above      = spaceAbove >= elH + POPUP_GAP || spaceAbove >= spaceBelow;

    let top;
    if (above) {
      top = rect.top - elH - POPUP_GAP;
      el.classList.add('popup--above'); el.classList.remove('popup--below');
    } else {
      top = rect.bottom + POPUP_GAP;
      el.classList.add('popup--below'); el.classList.remove('popup--above');
    }

    let left        = rect.left + rect.width / 2 - ARROW_OFF;
    const rightEdge = left + elW + 8;
    if (rightEdge > vp.w) left = vp.w - elW - 8;
    if (left < 8)         left = 8;

    el.style.top  = Math.round(top)  + 'px';
    el.style.left = Math.round(left) + 'px';
  }


  /* ════════════════════════════════════════════════════════════
     Hover mode (desktop only)
     ════════════════════════════════════════════════════════════ */

  function showCard(trigger) {
    if (persistent) return;
    clearTimeout(hideTimer);
    cardTrigger = trigger;
    fillCard(trigger);

    /* Clean up any leftover modal state from a previous mobile session */
    if (card.open) card.close();
    card.classList.remove('is-persistent', 'author-card--modal', 'popup--above', 'popup--below', 'is-visible');
    card.setAttribute('role', 'tooltip');
    card.setAttribute('aria-live', 'polite');
    card.setAttribute('aria-modal', 'false');
    card.style.top  = '-9999px';
    card.style.left = '-9999px';
    card.show();

    requestAnimationFrame(function () {
      positionEl(card, trigger);
      card.classList.add('is-visible');
    });

    afterShow(trigger);
  }

  function hideCard() {
    if (persistent) return;
    card.classList.remove('is-visible');
    card.close();
    cardTrigger = null;
  }

  function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(hideCard, HIDE_DELAY); }
  function cancelHide()   { clearTimeout(hideTimer); }


  /* ════════════════════════════════════════════════════════════
     Persistent / mobile mode
     ════════════════════════════════════════════════════════════ */

  function openCard(trigger) {
    clearTimeout(hideTimer);
    cardTrigger = trigger;
    fillCard(trigger);
    persistent = true;

    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-live', 'off');

    if (isMobile()) {
      /* ── Centered modal ── */
      currentIndex = triggerList.indexOf(trigger);
      card.classList.remove('popup--above', 'popup--below', 'is-visible');
      card.classList.add('author-card--modal');
      card.style.top  = '';
      card.style.left = '';
      updateNav(currentIndex);
      try { card.showModal(); } catch (_) { card.show(); }

      requestAnimationFrame(function () {
        card.classList.add('is-visible', 'is-persistent');
        card.querySelector('.author-card__name-link').focus();
      });
    } else {
      /* ── Desktop persistent (click) ── */
      card.classList.remove('popup--above', 'popup--below', 'is-visible');
      card.style.top  = '-9999px';
      card.style.left = '-9999px';
      if (!card.open) card.show();

      requestAnimationFrame(function () {
        positionEl(card, cardTrigger);
        card.classList.add('is-visible', 'is-persistent');
        card.querySelector('.author-card__name-link').focus();
      });
    }

    afterOpen(trigger);
  }

  function closeCard() {
    persistent = false;
    card.classList.remove('is-visible', 'is-persistent');
    /* author-card--modal intentionally kept – removed lazily in showCard when tooltip is next used */
    if (card.open) card.close();
    if (cardTrigger) { cardTrigger.focus(); cardTrigger = null; }
  }


  /* ════════════════════════════════════════════════════════════
     Events
     ════════════════════════════════════════════════════════════ */

  function bindEvents() {

    document.addEventListener('mouseover', function (e) {
      if (isMobile()) return;
      const trigger = e.target.closest(TRIGGER_SEL);
      if (trigger) { showCard(trigger); return; }
      if (e.target.closest('#' + CARD_ID)) { cancelHide(); }
    });

    document.addEventListener('mouseout', function (e) {
      if (isMobile()) return;
      if (e.target.closest(TRIGGER_SEL) || e.target.closest('#' + CARD_ID)) { scheduleHide(); }
    });

    document.addEventListener('focusin', function (e) {
      if (isMobile() || persistent) return;
      const trigger = e.target.closest(TRIGGER_SEL);
      if (trigger) { showCard(trigger); }
    });

    document.addEventListener('focusout', function (e) {
      if (isMobile()) return;
      if (e.target.closest(TRIGGER_SEL)) { scheduleHide(); }
    });

    document.addEventListener('click', function (e) {
      /* Author navigation */
      const navBtn = e.target.closest('.author-card__nav-btn');
      if (navBtn) { navigateTo(parseInt(navBtn.dataset.navIndex, 10)); return; }

      /* Mobile tap → open sheet; desktop click → follow link */
      const trigger = e.target.closest(TRIGGER_SEL);
      if (trigger) {
        if (!isMobile() && !window.matchMedia('(pointer: coarse)').matches) return;
        e.preventDefault();
        openCard(trigger);
        return;
      }

      if (e.target.closest('.author-card__close')) { closeCard(); return; }
    });

    /* Click outside card closes persistent mode (desktop only) */
    document.addEventListener('mousedown', function (e) {
      if (!persistent || isMobile()) return;
      if (!e.target.closest('#' + CARD_ID) && !e.target.closest(TRIGGER_SEL)) { closeCard(); }
    });

    /* Clicking the ::backdrop area fires a click event with target === dialog */
    card.addEventListener('click', function (e) {
      if (e.target === card) { closeCard(); }
    });

    /* Prevent dialog's native Escape close so our closeCard() handles cleanup */
    card.addEventListener('cancel', function (e) { e.preventDefault(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (persistent)           { closeCard(); }
        else if (cardIsVisible()) { hideCard(); if (cardTrigger) cardTrigger.focus(); }
      }
    });

    window.addEventListener('scroll', function () {
      if (!persistent && cardIsVisible() && cardTrigger) { positionEl(card, cardTrigger); }
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (cardIsVisible() && cardTrigger) { positionEl(card, cardTrigger); }
    }, { passive: true });
  }


  /* ── Boot ── */
  createCard();
  collectTriggers();
  bindEvents();

  return {
    /** Re-populates the card if trigger is still the currently displayed one. */
    repopulate: function (trigger) {
      if (cardTrigger === trigger && cardIsVisible()) {
        onPopulate(trigger, card);
      }
    },
    /** Re-collects all .author-trigger elements — call after byline DOM changes. */
    refresh: collectTriggers
  };
};
