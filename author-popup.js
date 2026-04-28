/**
 * author-popup.js – Prototype initialiser (requires author-card-core.js)
 *
 * Reads author data from data-* attributes pre-set in index.html.
 * All card behaviour lives in author-card-core.js.
 */
(function () {
  'use strict';

  function populateCard(trigger, card) {
    const src   = trigger.dataset.authorPhoto || '';
    const photo = card.querySelector('.author-card__photo');
    photo.src           = src;
    photo.alt           = trigger.dataset.authorName || '';
    photo.style.display = src ? '' : 'none';

    const name = trigger.dataset.authorName || trigger.textContent.trim();
    const profileHref = trigger.href || '#';

    const nameLink = card.querySelector('.author-card__name-link');
    nameLink.textContent = name;
    nameLink.href = profileHref;
    card.querySelector('.author-card__role').textContent = trigger.dataset.authorRole || '';
    card.querySelector('.author-card__bio').textContent  = trigger.dataset.authorBio  || '';

    const profileLink = card.querySelector('.author-card__profile-link');
    profileLink.href = profileHref;

    const followLink = card.querySelector('.author-card__follow');
    const followUrl  = trigger.dataset.authorFollow || '';
    followLink.href          = followUrl || '#';
    followLink.style.display = followUrl ? '' : 'none';
  }

  function init() {
    window.authorWidget = AuthorCardWidget({ populateCard });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
