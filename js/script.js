import { initTopicExplorer } from "./topic-explorer.js";

const menuToggle = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
const topicExplorer = document.querySelector("[data-topic-explorer]");
const topicSection = document.querySelector("#topics");

function setMenu(open) {
  if (!menuToggle || !menu) return;

  menuToggle.setAttribute("aria-expanded", String(open));
  menu.dataset.open = String(open);
}

function closeMenu({ returnFocus = false } = {}) {
  setMenu(false);
  if (returnFocus) menuToggle?.focus();
}

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  setMenu(!isOpen);
});

menu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => closeMenu());
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    menuToggle?.getAttribute("aria-expanded") === "true"
  ) {
    closeMenu({ returnFocus: true });
  }
});

document.querySelectorAll("[data-topics-link]").forEach((link) => {
  link.addEventListener("click", () => {
    window.requestAnimationFrame(() =>
      topicSection?.focus({ preventScroll: true }),
    );
  });
});

// Register independent navigation before validating topic markup.
if (topicExplorer) initTopicExplorer(topicExplorer);
