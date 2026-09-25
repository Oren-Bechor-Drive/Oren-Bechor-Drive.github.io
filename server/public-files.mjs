// Shared by local delivery and the Worker package. Server files are never assets.
export const publicTypes = Object.freeze({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json" });
export const publicTopFiles = Object.freeze(["index.html", "404.html", "robots.txt", "sitemap.xml", "llms.txt", "site.webmanifest"]);
export const publicDirectories = Object.freeze(["account", "assets", "css", "js", "course"]);
