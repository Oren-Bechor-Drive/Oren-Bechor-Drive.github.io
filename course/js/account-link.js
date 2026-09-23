const profile = document.querySelector(".course-profile");

async function connectAccount() {
	if (!profile) return;
	try {
		const response = await fetch("/api/account/session", { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(5000) });
		if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
		const session = await response.json();
		if (!session.available) return;
		const link = document.createElement("a");
		link.className = profile.className;
		link.href = session.user ? "/account/" : "/account/login.html";
		const label = session.user ? "החשבון שלי" : "כניסה לחשבון";
		link.setAttribute("aria-label", label);
		link.title = label;
		link.append(...profile.childNodes);
		profile.replaceWith(link);
	} catch { /* Public topic navigation works when the account service is absent. */ }
}

void connectAccount();
