export function initTopicExplorer(root) {
  const cards = [...root.querySelectorAll(".topic-card")];
  const panel = root.querySelector("[data-topic-panel]");
  const title = panel?.querySelector("[data-topic-panel-title]");
  const description = panel?.querySelector("[data-topic-panel-description]");

  if (cards.length === 0 || !panel || !title || !description) {
    throw new Error("Missing required topic panel elements");
  }

  const browserWindow = root.ownerDocument.defaultView;
  const reducedMotion =
    browserWindow?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;
  let pendingUpdate;

  function updateContent(card) {
    title.textContent = card.textContent.trim();
    description.textContent = card.dataset.topicDescription ?? "";
    panel.dataset.updating = "false";
  }

  function select(card, { animate = true } = {}) {
    cards.forEach((candidate) => {
      const selected = candidate === card;
      candidate.dataset.active = String(selected);
      candidate.setAttribute("aria-expanded", String(selected));
    });

    browserWindow?.clearTimeout(pendingUpdate);
    if (!animate || reducedMotion) {
      updateContent(card);
      return;
    }

    panel.dataset.updating = "true";
    pendingUpdate = browserWindow?.setTimeout(() => updateContent(card), 110);
  }

  cards.forEach((card, index) => {
    card.addEventListener("click", () => select(card));
    card.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowLeft") nextIndex = (index + 1) % cards.length;
      if (event.key === "ArrowRight")
        nextIndex = (index - 1 + cards.length) % cards.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = cards.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      cards[nextIndex].focus();
    });
  });

  const initiallyActive =
    cards.find((card) => card.dataset.active === "true") ?? cards[0];
  select(initiallyActive, { animate: false });
}
