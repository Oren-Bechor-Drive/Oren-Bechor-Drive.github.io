import { initTopicExplorer } from "./topic-explorer.js";
import { initDisclosureMotion } from "./disclosure-motion.js";
import { initScrollReveals } from "./scroll-reveal.js";
import { initHeroRoadCar } from "./hero-road-car.js";

const menuToggle = document.querySelector("[data-menu-toggle]");
const menu = document.querySelector("[data-menu]");
const topicExplorer = document.querySelector("[data-topic-explorer]");
const courseSection = document.querySelector("#about");

initScrollReveals(document);
initHeroRoadCar(document.querySelector(".hero"));

// Settle off-screen controls before the browser scrolls the focused button into view.
document.querySelector(".hero-actions")?.addEventListener("focusin", () => {
	document.querySelectorAll(".hero-copy > p, .hero-actions").forEach(element => {
		element.getAnimations().forEach(animation => animation.finish());
	});
});

const setMenu = menuToggle && menu
	? initDisclosureMotion(menuToggle, menu, "(max-width: 768px)", true)
	: () => {};
if (menuToggle && menu) document.documentElement.dataset.menuEnhanced = "true";

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
