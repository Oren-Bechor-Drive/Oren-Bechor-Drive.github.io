import { initTopicExplorer } from "./topic-explorer.js";
import { initRoadCarousel } from "./road-carousel.js";
import { initDisclosureMotion } from "./disclosure-motion.js";

const menuToggle = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
const topicExplorer = document.querySelector("[data-topic-explorer]");
const topicSection = document.querySelector("#topics");

const setMenu = menuToggle && menu
	? initDisclosureMotion(menuToggle, menu, "(max-width: 768px)", true)
	: () => {};

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

const roadCarousel = document.querySelector("[data-road-carousel]");

if (roadCarousel) {
	initRoadCarousel(roadCarousel).catch((error) => {
		console.warn(
			"Student gallery could not refresh; keeping the static photos.",
			error,
		);
	});
}

// Footer labels work immediately; fetch the icon kit only near the footer.
const socialFooter = document.querySelector("[data-icon-kit]");
if (socialFooter) {
	const loadIcons = () => {
		const script = document.createElement("script");
		script.src = socialFooter.dataset.iconKit;
		script.crossOrigin = "anonymous";
		script.async = true;
		document.head.append(script);
	};
	if ("IntersectionObserver" in window) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();
				loadIcons();
			},
			{ rootMargin: "300px" },
		);
		observer.observe(socialFooter);
	} else window.addEventListener("load", loadIcons, { once: true });
}

// Register independent page controls before validating topic markup.
if (topicExplorer) initTopicExplorer(topicExplorer);
