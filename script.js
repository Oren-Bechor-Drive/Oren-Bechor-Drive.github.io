const menuToggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
const topicCards = [...document.querySelectorAll('.topic-card')];
const topicPanel = document.querySelector('[data-topic-panel]');
const topicPanelTitle = topicPanel?.querySelector('[data-topic-panel-title]');
const topicPanelDescription = topicPanel?.querySelector('[data-topic-panel-description]');
const topicSection = document.querySelector('#topics');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function setMenu(open) {
  if (!menuToggle || !menu) return;

  menuToggle.setAttribute('aria-expanded', String(open));
  menu.dataset.open = String(open);
}

function closeMenu({ returnFocus = false } = {}) {
  setMenu(false);
  if (returnFocus) menuToggle?.focus();
}

menuToggle?.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  setMenu(!isOpen);
});

menu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => closeMenu());
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle?.getAttribute('aria-expanded') === 'true') {
    closeMenu({ returnFocus: true });
  }
});

function renderTopic(card) {
  if (!topicPanel || !topicPanelTitle || !topicPanelDescription) return;

  topicCards.forEach((topicCard) => {
    const selected = topicCard === card;
    topicCard.dataset.active = String(selected);
    topicCard.setAttribute('aria-expanded', String(selected));
  });

  const updateContent = () => {
    topicPanelTitle.textContent = card.dataset.topicTitle ?? '';
    topicPanelDescription.textContent = card.dataset.topicDescription ?? '';
    topicPanel.dataset.updating = 'false';
  };

  if (reduceMotion.matches) {
    updateContent();
    return;
  }

  topicPanel.dataset.updating = 'true';
  window.setTimeout(updateContent, 110);
}

topicCards.forEach((card, index) => {
  card.addEventListener('click', () => renderTopic(card));

  card.addEventListener('keydown', (event) => {
    let nextIndex;

    if (event.key === 'ArrowLeft') nextIndex = (index + 1) % topicCards.length;
    if (event.key === 'ArrowRight') nextIndex = (index - 1 + topicCards.length) % topicCards.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = topicCards.length - 1;

    if (nextIndex === undefined) return;

    event.preventDefault();
    topicCards[nextIndex].focus();
  });
});

document.querySelectorAll('[data-topics-link]').forEach((link) => {
  link.addEventListener('click', () => {
    window.requestAnimationFrame(() => topicSection?.focus({ preventScroll: true }));
  });
});
