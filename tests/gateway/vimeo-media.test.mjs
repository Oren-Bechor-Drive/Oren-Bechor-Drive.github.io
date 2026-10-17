import assert from "node:assert/strict";
import test from "node:test";
import { createVimeoMedia } from "../../server/vimeo-media.mjs";

const sectionId = "a524e32d-2640-4d94-a51c-000000000001";
const contentVersionId = "a524e32d-2640-4d94-a51c-000000000002";
const video = {
  id: "left-turn",
  sectionId,
  contentVersionId,
  title: "סרטון בדיקה",
  vimeoId: "123456789",
};

test("Vimeo descriptors become player URLs only for their exact section version", () => {
  const media = createVimeoMedia({
    entries: [
      { ...video, hash: "abc123def0", captions: "he-x-autogen" },
      { ...video, id: "old", contentVersionId: sectionId },
    ],
  });
  assert.deepEqual(media.forSection(sectionId, contentVersionId), [
    {
      id: "left-turn",
      title: "סרטון בדיקה",
      type: "video/vimeo",
      url: "https://player.vimeo.com/video/123456789?h=abc123def0&dnt=1&texttrack=he-x-autogen",
    },
  ]);
  assert.deepEqual(
    media.forSection(sectionId, sectionId).map((item) => item.id),
    ["old"],
  );
  assert.equal(media.lookup("left-turn"), undefined);
});

test("Vimeo media keeps file-based media delivery and rejects shared IDs", async () => {
  const image = {
    id: "diagram",
    title: "תרשים",
    type: "image/png",
    url: "/api/media/diagram",
  };
  const sent = [];
  const files = {
    lookup: (id) => (id === "diagram" ? image : undefined),
    forSection: () => [image],
    send: async (...args) => sent.push(args),
  };
  const media = createVimeoMedia({ entries: [video], files });
  assert.deepEqual(
    media.forSection(sectionId, contentVersionId).map((item) => item.type),
    ["image/png", "video/vimeo"],
  );
  assert.equal(media.lookup("diagram"), image);
  await media.send("req", "res", image);
  assert.deepEqual(sent, [["req", "res", image]]);
  assert.throws(
    () => createVimeoMedia({ entries: [{ ...video, id: "diagram" }], files }),
    { configurationField: "VIMEO_MEDIA_ENTRIES" },
  );
});

test("invalid Vimeo descriptors fail with only the configuration field", () => {
  for (const entries of [
    {},
    [{ ...video, vimeoId: "https://vimeo.com/123" }],
    [{ ...video, vimeoId: 123456789 }],
    [{ ...video, sectionId: "section" }],
    [{ ...video, title: " " }],
    [{ ...video, hash: "../x" }],
    [{ ...video, captions: "he&autoplay=1" }],
    [{ ...video, file: "video.mp4" }],
    [video, video],
  ])
    assert.throws(
      () => createVimeoMedia({ entries }),
      (error) => {
        assert.equal(error.configurationField, "VIMEO_MEDIA_ENTRIES");
        assert.equal(error.configurationReason, "invalid");
        return true;
      },
    );
});
