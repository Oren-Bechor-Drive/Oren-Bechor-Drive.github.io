// Sample the rendered road so the car keeps its shape and speed at every viewport ratio.
export function initHeroRoadCar(hero) {
	const car = hero?.querySelector(".hero-road-car");
	const road = hero?.querySelector(".hero-road-surface");
	if (!car?.animate || !road?.getPointAtLength || !window.ResizeObserver) return;
	const svg = road.ownerSVGElement;
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const driveDuration = 15_000;
	const pauseDuration = 5_000;
	const cycleDuration = driveDuration + pauseDuration;
	let animation;

	function update() {
		const elapsed = animation?.currentTime ?? 0;
		const paused = animation?.playState === "paused";
		animation?.cancel();
		const scaleX = svg.clientWidth / svg.viewBox.baseVal.width;
		const scaleY = svg.clientHeight / svg.viewBox.baseVal.height;
		const length = road.getTotalLength();
		const points = Array.from({ length: 301 }, (_, index) => {
			const point = road.getPointAtLength(length * index / 300);
			return { x: point.x * scaleX, y: point.y * scaleY };
		});
		// Extend beyond both edges so the complete car exits before the repeat pause.
		function extend(point, neighbor) {
			const dx = point.x - neighbor.x;
			const dy = point.y - neighbor.y;
			const distance = Math.hypot(dx, dy);
			return { x: point.x + dx / distance * 100, y: point.y + dy / distance * 100 };
		}
		points.unshift(extend(points[0], points[1]));
		points.push(extend(points.at(-1), points.at(-2)));
		let distance = 0;
		let previousAngle;
		const frames = points.map((point, index) => {
			const before = points[Math.max(0, index - 1)];
			const after = points[Math.min(points.length - 1, index + 1)];
			distance += Math.hypot(point.x - before.x, point.y - before.y);
			// The supplied car faces left. Unwrap angles to avoid spinning at ±180°.
			let angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI + 180;
			if (previousAngle !== undefined) {
				while (angle - previousAngle > 180) angle -= 360;
				while (angle - previousAngle < -180) angle += 360;
			}
			previousAngle = angle;
			return {
				offset: distance,
				transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) rotate(${angle}deg)`,
				opacity: 1,
			};
		});
		for (const frame of frames) frame.offset = frame.offset / distance * driveDuration / cycleDuration;
		if (reducedMotion.matches) {
			car.style.transform = frames[30].transform;
			car.style.opacity = "1";
			return;
		}
		frames.at(-1).opacity = 0;
		frames.push({ ...frames.at(-1), offset: 1 });
		animation = car.animate(frames, { duration: cycleDuration, iterations: Infinity, easing: "linear" });
		animation.currentTime = elapsed;
		if (paused) animation.pause();
	}

	new window.ResizeObserver(update).observe(svg);
	reducedMotion.addEventListener("change", update);
}
