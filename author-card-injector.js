/**
 * author-card-injector.js
 * Paste into DevTools console on any spiegel.de article page.
 *
 * Structure:
 *  ① Idempotent teardown
 *  ② CSS injection
 *  ③ Author link decoration
 *  ④ Lazy fetch + populateCard  (injector-specific)
 *  ⑤ Core widget               (⚠ copy of author-card-core.js – update both when changing)
 *  ⑥ Boot
 */
(function () {
  'use strict';


  /* ════════════════════════════════════════════════════════════
     ① Idempotent teardown
     ════════════════════════════════════════════════════════════ */

  document.getElementById('author-card')?.remove();
  document.getElementById('author-card-style')?.remove();
  document.querySelectorAll('.author-trigger[data-injected]').forEach(function (el) {
    el.classList.remove('author-trigger');
    delete el.dataset.injected;
    delete el.dataset.authorName;
    delete el.dataset.authorPhoto;
    delete el.dataset.authorRole;
    delete el.dataset.authorBio;
  });


  /* ════════════════════════════════════════════════════════════
     ② CSS injection
     All tokens scoped inside #author-card via --ac-* prefix
     so they don't clash with spiegel.de's own CSS variables.
     ════════════════════════════════════════════════════════════ */

  const style = document.createElement('style');
  style.id = 'author-card-style';
  style.textContent = `
#author-card {
  --ac-primary:   #e2001a;
  --ac-text:      #1a1a1a;
  --ac-text-sec:  #666666;
  --ac-border:    #d8d8d8;
  --ac-bg:        #ffffff;
  --ac-shadow:    0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08);
  --ac-radius:    4px;
  --ac-width:     308px;
  --ac-transition:0.13s ease;

  position: fixed;
  z-index: 99999;
  width: var(--ac-width);
  max-height: 400px;
  display: flex;
  flex-direction: column;
  background: var(--ac-bg);
  border: 1px solid var(--ac-border);
  border-radius: var(--ac-radius);
  box-shadow: var(--ac-shadow);
  opacity: 0;
  pointer-events: none;
  transform: translateY(6px);
  transition: opacity var(--ac-transition), transform var(--ac-transition);
  font-family: 'Source Sans 3', -apple-system, 'Helvetica Neue', Arial, sans-serif;
}
#author-card.is-visible { opacity: 1; pointer-events: auto; transform: translateY(0); }

/* Arrow */
#author-card.popup--above::after,
#author-card.popup--below::after {
  content: '';
  position: absolute;
  width: 10px; height: 10px;
  background: var(--ac-bg);
  border: 1px solid var(--ac-border);
  transform: rotate(45deg);
}
#author-card.popup--above::after { bottom: -6px; left: 20px; border-top: none; border-left: none; box-shadow: 2px 2px 4px rgba(0,0,0,0.06); }
#author-card.popup--below::after { top: -6px; left: 18px; border-bottom: none; border-right: none; }

/* Header */
.author-card__header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; flex-shrink: 0;
  border-bottom: 1px solid var(--ac-border);
}
.author-card__photo {
  width: 64px; height: 64px; border-radius: 50%;
  object-fit: cover; flex-shrink: 0; background: #eee;
}
.author-card__summary { flex: 1; min-width: 0; }
.author-card__name {
  display: block; font-size: 14px; font-weight: 700;
  color: var(--ac-text); line-height: 1.3;
}
.author-card__actions { display: flex; gap: 6px; margin-top: 7px; flex-wrap: wrap; }
.author-card__follow, .author-card__profile-link {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; font-size: 12px; font-weight: 600;
  text-decoration: none; border-radius: 3px;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.author-card__follow { background: var(--ac-primary); color: #fff; border: 1.5px solid var(--ac-primary); }
.author-card__follow:hover { background: #c0001a; border-color: #c0001a; }
.author-card__profile-link { background: transparent; color: var(--ac-text); border: 1.5px solid var(--ac-border); }
.author-card__profile-link:hover { border-color: var(--ac-text); }
.author-card__follow:focus-visible, .author-card__profile-link:focus-visible { outline: 2px solid var(--ac-primary); outline-offset: 2px; }
.author-card__role {
  display: block; font-size: 12px;
  color: var(--ac-text-sec); line-height: 1.4; margin-top: 1px;
}

/* Close button */
.author-card__close {
  display: none; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; background: none; border: none;
  border-radius: 50%; color: var(--ac-text); cursor: pointer;
  transition: color 0.1s, background 0.1s; flex-shrink: 0;
}
#author-card.is-persistent .author-card__close { display: flex; }
.author-card__close:hover { color: var(--ac-primary); background: #eee; }
.author-card__close:focus-visible { outline: 2px solid var(--ac-primary); outline-offset: 1px; }

/* Body */
.author-card__body { overflow-y: auto; flex: 1; }
.author-card__body::-webkit-scrollbar { width: 4px; }
.author-card__body::-webkit-scrollbar-track { background: transparent; }
.author-card__body::-webkit-scrollbar-thumb { background: var(--ac-border); border-radius: 2px; }
.author-card__bio {
  font-size: 13px; color: var(--ac-text);
  line-height: 1.55; padding: 12px 16px 12px;
}

/* Loading state */
.author-card__bio.is-loading { color: var(--ac-text-sec); font-style: italic; }

/* Centered modal mode (mobile) */
#author-card.author-card--modal {
  top: 50%; left: 50%;
  width: calc(100vw - 32px); max-width: 400px; max-height: 85vh;
  border-radius: 8px;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
#author-card.author-card--modal.is-visible {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
#author-card.author-card--modal::after { display: none; }

/* Navigation bar */
.author-card__nav {
  display: none;
  padding: 8px 12px; border-top: 1px solid var(--ac-border); flex-shrink: 0;
}
#author-card.author-card--modal .author-card__nav { display: block; }
.author-card__nav-slider {
  display: flex; gap: 8px; overflow-x: auto;
  scrollbar-width: none; -ms-overflow-style: none;
  scroll-snap-type: x mandatory;
}
.author-card__nav-slider::-webkit-scrollbar { display: none; }
.author-card__nav-btn {
  flex-shrink: 0; padding: 6px 14px;
  border: 1.5px solid var(--ac-border); border-radius: 999px;
  background: none; font-size: 14px; font-family: inherit;
  color: var(--ac-text); cursor: pointer; white-space: nowrap;
  scroll-snap-align: start;
}
.author-card__nav-btn--active { border-color: var(--ac-text); font-weight: 600; }
.author-card__nav-btn:hover:not(.author-card__nav-btn--active) { border-color: #666; }
  `;
  document.head.appendChild(style);


  /* ════════════════════════════════════════════════════════════
     ③ Author link decoration
     ════════════════════════════════════════════════════════════ */

  /* Try to scope to the article intro; fall back to the whole document */
  const scope = document.querySelector('[data-area="intro"], header article, article header, main header')
             || document;

  const authorLinks = scope.querySelectorAll('a[href*="/impressum/autor-"]');

  if (!authorLinks.length) {
    console.warn('[author-card] No author links found on this page.');
  }

  authorLinks.forEach(function (link) {
    link.classList.add('author-trigger');
    link.dataset.injected   = '1';
    link.dataset.authorName = link.title || link.textContent.trim();
    /* photo / role / bio populated lazily by ensureData() */
  });

  console.log('[author-card] Decorated', authorLinks.length, 'author link(s).');


  /* ════════════════════════════════════════════════════════════
     ④ Lazy fetch + populateCard  (injector-specific)
     ════════════════════════════════════════════════════════════ */

  const cache = new Map();   /* url → { photo, role, bio } | null (in-flight) */

  async function fetchAuthorPage(url) {
    const res = await fetch(url, { credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  function parseAuthorDoc(doc, authorName) {
    const meta = function (prop) {
      const el = doc.querySelector('meta[property="' + prop + '"], meta[name="' + prop + '"]');
      return el ? el.getAttribute('content') || '' : '';
    };

    /* Portrait: match by author name first (precise), fall back to first rounded-circle img.
       Upgrade to _w144_ for sharper display at 40×40 px. */
    let photo = '';
    const byName      = authorName
      ? doc.querySelector('img[alt="' + authorName + '"][class*="rounded-circle"]')
      : null;
    const portraitImg = byName
      || doc.querySelector('img[data-image-el="img"][class*="rounded-circle"]');
    if (portraitImg) {
      photo = portraitImg.dataset.src || portraitImg.src || '';
      if (!photo || photo.startsWith('data:')) photo = '';
      if (photo) photo = photo.replace(/_w(\d+)_/, '_w144_');
    }
    /* No og:image fallback — it returns generic logos for authors without portraits. */

    const bio = meta('og:description') || meta('description') || '';

    /* Role: try several selectors that appear on spiegel.de author pages */
    let role = '';
    for (const sel of ['[data-testid="author-role"]', '[class*="AuthorRole"]', '[class*="author-role"]', '[class*="JobTitle"]']) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim()) { role = el.textContent.trim(); break; }
    }

    return { photo, role, bio };
  }

  function applyCache(trigger) {
    const data = cache.get(trigger.href);
    if (!data) return;
    if (data.photo) trigger.dataset.authorPhoto = data.photo;
    if (data.role)  trigger.dataset.authorRole  = data.role;
    if (data.bio)   trigger.dataset.authorBio   = data.bio;
  }

  async function ensureData(trigger) {
    const url = trigger.href;
    if (cache.has(url)) {
      applyCache(trigger);
      return;
    }
    cache.set(url, null);   /* mark in-flight to prevent double-fetch */
    try {
      const doc  = await fetchAuthorPage(url);
      const data = parseAuthorDoc(doc, trigger.dataset.authorName || '');
      cache.set(url, data);
    } catch (err) {
      console.warn('[author-card] Could not fetch author data from', url, err);
      cache.set(url, {});
    }
    applyCache(trigger);
    widget.repopulate(trigger);   /* re-populate card if still visible */
  }

  function populateCard(trigger, card) {
    const src   = trigger.dataset.authorPhoto || '';
    const photo = card.querySelector('.author-card__photo');
    photo.src           = src;
    photo.alt           = trigger.dataset.authorName || '';
    photo.style.display = src ? '' : 'none';

    card.querySelector('.author-card__name').textContent = trigger.dataset.authorName || trigger.textContent.trim();
    card.querySelector('.author-card__role').textContent = trigger.dataset.authorRole || '';
    card.querySelector('.author-card__profile-link').href = trigger.href || '#';

    const bio = card.querySelector('.author-card__bio');
    if (trigger.dataset.authorBio) {
      bio.textContent = trigger.dataset.authorBio;
      bio.classList.remove('is-loading');
    } else {
      bio.textContent = 'Wird geladen \u2026';
      bio.classList.add('is-loading');
    }

    const followLink = card.querySelector('.author-card__follow');
    if (followLink) followLink.style.display = 'none';
  }


  /* ════════════════════════════════════════════════════════════
     ⑤ Core widget
     ⚠ Based on AuthorCardWidget() in author-card-core.js.
       Key differences: uses <div> not <dialog>, manual backdrop div, author-card--sheet class.
       Edit author-card-core.js first, then port changes here.
     ════════════════════════════════════════════════════════════ */

  function AuthorCardWidget(options) {

    const TRIGGER_SEL = '.author-trigger';
    const CARD_ID     = 'author-card';
    const MOBILE_BP   = 720;
    const HIDE_DELAY  = 150;
    const POPUP_GAP   = 10;
    const ARROW_OFF   = 24;

    const onPopulate = options.populateCard;
    const afterShow  = options.afterShow || function () {};
    const afterOpen  = options.afterOpen || function () {};

    let card         = null;
    let hideTimer    = null;
    let cardTrigger  = null;
    let persistent   = false;
    let triggerList  = [];
    let currentIndex = -1;

    function createCard() {
      card = document.createElement('div');
      card.id = CARD_ID;
      card.setAttribute('role', 'tooltip');
      card.setAttribute('aria-live', 'polite');
      card.innerHTML = `
        <div class="author-card__header">
          <img class="author-card__photo" src="" alt="" width="64" height="64">
          <div class="author-card__summary">
            <strong class="author-card__name"></strong>
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

    function collectTriggers() {
      triggerList = Array.from(document.querySelectorAll(TRIGGER_SEL));
    }

    function updateNav(index) {
      const slider = card.querySelector('.author-card__nav-slider');
      if (!slider) return;
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
      afterOpen(cardTrigger);
    }

    function positionEl(el, trigger) {
      const rect = trigger.getBoundingClientRect();
      const elH  = el.offsetHeight;
      const elW  = el.offsetWidth || 308;
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

    function showCard(trigger) {
      if (persistent) return;
      clearTimeout(hideTimer);
      cardTrigger = trigger;
      fillCard(trigger);

      card.classList.remove('is-persistent', 'author-card--modal', 'popup--above', 'popup--below', 'is-visible');
      card.setAttribute('role', 'tooltip');
      card.setAttribute('aria-live', 'polite');
      card.setAttribute('aria-modal', 'false');
      card.style.top  = '-9999px';
      card.style.left = '-9999px';

      requestAnimationFrame(function () {
        positionEl(card, trigger);
        card.classList.add('is-visible');
      });

      afterShow(trigger);
    }

    function hideCard() {
      if (persistent) return;
      card.classList.remove('is-visible');
      cardTrigger = null;
    }

    function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(hideCard, HIDE_DELAY); }
    function cancelHide()   { clearTimeout(hideTimer); }

    function openCard(trigger) {
      clearTimeout(hideTimer);
      cardTrigger = trigger;
      fillCard(trigger);
      persistent = true;

      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-live', 'off');

      if (isMobile()) {
        currentIndex = triggerList.indexOf(trigger);
        card.classList.remove('popup--above', 'popup--below', 'is-visible');
        card.classList.add('author-card--modal');
        card.style.top  = '';
        card.style.left = '';
        updateNav(currentIndex);

        requestAnimationFrame(function () {
          card.classList.add('is-visible', 'is-persistent');
          card.querySelector('.author-card__profile-link').focus();
        });
      } else {
        card.classList.remove('popup--above', 'popup--below', 'is-visible');
        card.style.top  = '-9999px';
        card.style.left = '-9999px';

        requestAnimationFrame(function () {
          positionEl(card, cardTrigger);
          card.classList.add('is-visible', 'is-persistent');
          card.querySelector('.author-card__profile-link').focus();
        });
      }

      afterOpen(trigger);
    }

    function closeCard() {
      persistent = false;
      card.classList.remove('is-visible', 'is-persistent');
      if (cardTrigger) { cardTrigger.focus(); cardTrigger = null; }
    }

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
        const navBtn = e.target.closest('.author-card__nav-btn');
        if (navBtn) { navigateTo(parseInt(navBtn.dataset.navIndex, 10)); return; }

        const trigger = e.target.closest(TRIGGER_SEL);
        if (trigger) {
          if (!isMobile() && !window.matchMedia('(pointer: coarse)').matches) return;
          e.preventDefault();
          openCard(trigger);
          return;
        }

        if (e.target.closest('.author-card__close')) { closeCard(); return; }
      });

      document.addEventListener('mousedown', function (e) {
        if (!persistent || isMobile()) return;
        if (!e.target.closest('#' + CARD_ID) && !e.target.closest(TRIGGER_SEL)) { closeCard(); }
      });

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

    createCard();
    collectTriggers();
    bindEvents();

    return {
      repopulate: function (trigger) {
        if (cardTrigger === trigger && cardIsVisible()) {
          onPopulate(trigger, card);
        }
      }
    };
  }

  /* ════════════════════════════════════════════════════════════
     ⑥ Boot
     ════════════════════════════════════════════════════════════ */

  /* widget declared first so ensureData() can reference it when its fetch resolves */
  let widget;
  widget = AuthorCardWidget({
    populateCard,
    afterShow: ensureData,
    afterOpen: ensureData,
  });

  console.log('[author-card] Ready. Hover or tap an author name to test.');

}());
