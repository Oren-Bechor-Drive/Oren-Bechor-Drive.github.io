// Shared by local delivery and the Worker package. Server files are never assets.
export const publicTypes = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
});
export const publicTopFiles = Object.freeze([
  "index.html",
  "404.html",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "indexnow-key.txt",
  "llms.txt",
  "site.webmanifest",
]);
export const publicDirectories = Object.freeze([
  "account",
  "assets",
  "css",
  "js",
  "course",
]);
// The single public-path rule for serving, packaging and readiness checks.
// Takes a decoded "/..." pathname; returns its relative path or null. Extensionless
// paths may name directories, so adapters still resolve index files and check types.
export function publicRelativePath(pathname) {
  const parts = pathname.slice(1).split("/");
  if (
    parts.some(
      (part) =>
        part.startsWith(".") || part.includes("\\") || part.includes("\0"),
    )
  )
    return null;
  const relative = pathname.slice(1) || "index.html";
  if (
    !publicTopFiles.includes(relative) &&
    !publicDirectories.includes(parts[0])
  )
    return null;
  const last = parts.at(-1);
  if (last.includes(".") && !publicTypes[last.slice(last.lastIndexOf("."))])
    return null;
  return relative;
}
export const publicSecurityHeaders = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "frame-ancestors 'none'",
});
