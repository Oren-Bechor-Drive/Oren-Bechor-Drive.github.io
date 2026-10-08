export function initTopicExplorer(root) {
	const cards = [...root.querySelectorAll('.topic-card')];
	const panel = root.querySelector('[data-topic-panel]');
	const title = panel?.querySelector('[data-topic-panel-title]');
	const description = panel?.querySelector('[data-topic-panel-description]');
	const link = panel?.querySelector('[data-topic-panel-link]');
	const summaries = root.querySelector('[data-topic-summaries]');
	const descriptions = [...(summaries?.querySelectorAll('p') ?? [])];
	const links = [...(summaries?.querySelectorAll('h3 a') ?? [])];
	if (!cards.length || !panel || !title || !description || descriptions.length !== cards.length)
		throw new Error('Missing required topic panel elements');
	const document = root.ownerDocument;
	const window = document.defaultView;
	const reducedMotion = window?.matchMedia?.('(prefers-reduced-motion: reduce)');
	const mobile = window?.matchMedia?.('(max-width: 639px)');
	const rail = root.querySelector('.topic-rail');
	let pendingUpdate;
	let selectedCard;
	panel.id ||= 'home-topic-panel';
	panel.setAttribute('role', 'tabpanel');
	panel.tabIndex = 0;
	panel.removeAttribute('aria-live');
	if (rail) {
		rail.setAttribute('role', 'tablist');
		rail.setAttribute('aria-label', 'נושאי הלימוד');
		rail.hidden = false;
	}
	cards.forEach((card, index) => {
		card.id ||= `home-topic-${index + 1}`;
		card.setAttribute('role', 'tab');
		card.setAttribute('aria-controls', panel.id);
		card.removeAttribute('aria-expanded');
	});
	function updateContent(card) {
		window?.clearTimeout(pendingUpdate);
		const index = cards.indexOf(card);
		title.textContent = card.textContent.trim();
		description.textContent = descriptions[index].textContent.trim();
		const source = links[index];
		if (link && source) link.href = source.href;
		panel.dataset.updating = 'false';
	}
	function select(card, { animate = true } = {}) {
		if (card === selectedCard && animate) return;
		selectedCard = card;
		panel.setAttribute('aria-labelledby', card.id);
		cards.forEach(candidate => {
			const selected = candidate === card;
			candidate.dataset.active = String(selected);
			candidate.setAttribute('aria-selected', String(selected));
			candidate.tabIndex = selected ? 0 : -1;
		});
		const withMotion = animate && !reducedMotion?.matches;
		panel.dataset.motion = withMotion ? 'pointer' : 'instant';
		window?.clearTimeout(pendingUpdate);
		if (!withMotion) return updateContent(card);
		panel.dataset.updating = 'true';
		pendingUpdate = window?.setTimeout(() => updateContent(card), 110);
	}
	cards.forEach((card, index) => {
		card.addEventListener('click', event => select(card, { animate: event.detail > 0 }));
		card.addEventListener('keydown', event => {
			const delta = { ArrowLeft: 1, ArrowRight: -1, ArrowDown: 2, ArrowUp: -2 }[event.key];
			const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : delta === undefined ? undefined : (index + delta + cards.length) % cards.length;
			if (next === undefined) return;
			event.preventDefault();
			select(cards[next], { animate: false });
			cards[next].focus();
		});
	});
	function updateLayout() {
		const focusedLink = links.indexOf(document.activeElement);
		const focusedPreview = rail?.contains(document.activeElement) || panel.contains(document.activeElement);
		summaries.hidden = !mobile?.matches;
		panel.hidden = Boolean(mobile?.matches);
		if (rail) rail.hidden = Boolean(mobile?.matches);
		if (mobile?.matches && focusedPreview) {
			(links[cards.indexOf(selectedCard)] ?? root).focus({ preventScroll: true });
		} else if (!mobile?.matches && focusedLink >= 0 && cards[focusedLink]) {
			select(cards[focusedLink], { animate: false });
			cards[focusedLink].focus({ preventScroll: true });
		}
	}
	reducedMotion?.addEventListener?.('change', () => {
		if (reducedMotion.matches) {
			panel.dataset.motion = 'instant';
			updateContent(selectedCard);
		}
	});
	mobile?.addEventListener?.('change', updateLayout);
	select(cards.find(card => card.dataset.active === 'true') ?? cards[0], { animate: false });
	updateLayout();
	root.dataset.topicEnhanced = 'true';
}
