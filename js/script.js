import "./input-mode.js";
import { initTopicExplorer } from "./topic-explorer.js";
import { initDisclosureMotion } from "./disclosure-motion.js";
import { initScrollReveals } from "./scroll-reveal.js";
import { initHeroRoadCar } from "./hero-road-car.js";
import { initFaqDisclosures } from "./faq-disclosures.js";

const menuToggle = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
const topicExplorer = document.querySelector("[data-topic-explorer]");
const courseSection = document.querySelector("#topics");

document.documentElement.dataset.heroEntrance = "true";

initScrollReveals(document);
initHeroRoadCar(document.querySelector(".hero"));
initFaqDisclosures(document.querySelector("#faq"));

// Settle off-screen controls before the browser scrolls the focused button into view.
document.querySelector(".hero")?.addEventListener("focusin", () => {
	document.documentElement.dataset.heroEntrance = "false";
});

const enhanceMenu = menuToggle && menu && document.documentElement.dataset.menuFallback !== "true";
const setMenu =
	enhanceMenu
		? initDisclosureMotion(menuToggle, menu, "(max-width: 768px)", true)
		: () => {};
if (enhanceMenu) document.documentElement.dataset.menuEnhanced = "true";
delete document.documentElement.dataset.menuPending;

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

document.addEventListener("pointerdown", (event) => {
	if (!menu?.contains(event.target) && !menuToggle?.contains(event.target)) closeMenu();
});
menu?.closest(".nav-shell")?.addEventListener("focusout", (event) => {
	if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
});
window.addEventListener("scroll", () => closeMenu(), { passive: true });

document.querySelectorAll("[data-topics-link]").forEach((link) => {
	link.addEventListener("click", () => {
		window.requestAnimationFrame(() =>
			courseSection?.focus({ preventScroll: true }),
		);
	});
});

const roadCarousel = document.querySelector("[data-road-carousel]");

if (roadCarousel) {
	const loadGallery = () => {
		Promise.all([
			import("./road-carousel.js"),
			import("./road-photo-sources.js"),
		])
			.then(([{ initRoadCarousel }, { roadPhotoSources }]) =>
				initRoadCarousel(roadCarousel, roadPhotoSources),
			)
			.catch((error) => {
				console.warn(
					"Student gallery could not refresh; keeping the static photos.",
					error,
				);
			});
	};
	if ("IntersectionObserver" in window) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();
				loadGallery();
			},
			{ rootMargin: "300px" },
		);
		observer.observe(roadCarousel);
	} else loadGallery();
}

// Register independent page controls before validating topic markup.
if (topicExplorer) initTopicExplorer(topicExplorer);
