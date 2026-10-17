const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = new Set([
  "id",
  "sectionId",
  "contentVersionId",
  "title",
  "vimeoId",
  "hash",
  "captions",
]);
const invalid = () => {
  throw Object.assign(new Error("Invalid Vimeo media descriptor."), {
    configurationField: "VIMEO_MEDIA_ENTRIES",
    configurationReason: "invalid",
  });
};

// Paid sections embed Vimeo players. The gateway returns a player URL only with an
// authorized paid section; Vimeo's domain-level privacy must stop playback elsewhere.
// Optional `files` keeps a Storage or local adapter for images and file-based media.
export function createVimeoMedia({ entries, files = null }) {
  if (!Array.isArray(entries)) invalid();
  const ids = new Set();
  const videos = entries.map((input) => {
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => !fields.has(key)) ||
      typeof input.id !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(input.id) ||
      ids.has(input.id) ||
      files?.lookup(input.id) ||
      typeof input.sectionId !== "string" ||
      !uuid.test(input.sectionId) ||
      typeof input.contentVersionId !== "string" ||
      !uuid.test(input.contentVersionId) ||
      typeof input.title !== "string" ||
      !input.title.trim() ||
      input.title.length > 300 ||
      typeof input.vimeoId !== "string" ||
      !/^[1-9]\d{0,14}$/.test(input.vimeoId) ||
      (Object.hasOwn(input, "hash") &&
        (typeof input.hash !== "string" ||
          !/^[0-9a-f]{6,20}$/.test(input.hash))) ||
      (Object.hasOwn(input, "captions") &&
        (typeof input.captions !== "string" ||
          !/^[a-z]{2,3}(-[a-z0-9]{1,8}){0,3}$/.test(input.captions)))
    )
      invalid();
    ids.add(input.id);
    const url = new URL(`https://player.vimeo.com/video/${input.vimeoId}`);
    if (input.hash) url.searchParams.set("h", input.hash);
    url.searchParams.set("dnt", "1");
    if (input.captions) url.searchParams.set("texttrack", input.captions);
    return Object.freeze({
      sectionId: input.sectionId,
      contentVersionId: input.contentVersionId,
      id: input.id,
      title: input.title,
      url: url.href,
    });
  });
  return {
    // Players load from Vimeo, so only file-based media is served at /api/media/<id>.
    lookup: (id) => files?.lookup(id),
    forSection(sectionId, contentVersionId) {
      return [
        ...(files?.forSection(sectionId, contentVersionId) ?? []),
        ...videos
          .filter(
            (video) =>
              video.sectionId === sectionId &&
              video.contentVersionId === contentVersionId,
          )
          .map(({ id, title, url }) => ({
            id,
            title,
            type: "video/vimeo",
            url,
          })),
      ];
    },
    send: (req, res, entry) => files.send(req, res, entry),
  };
}
