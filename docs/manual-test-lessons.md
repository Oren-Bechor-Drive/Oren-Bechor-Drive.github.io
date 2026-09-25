# Manually test protected learning

This walkthrough runs the local gateway with deterministic Auth and a disposable PostgreSQL database. It uses synthetic learning sections and a synthetic practice quiz. No hosted Supabase, payment provider, or approved course content is involved. Closing the fixture deletes its accounts and progress.

## Start the fixture

From the repository root, with development dependencies installed, start `node`. At its prompt:

```js
var { startLessonGateway } = await import('./tests/helpers/test-lessons.mjs');
var app = await startLessonGateway({ quiz: true, longLesson: true });
console.log(app.origin + '/account/login.html');
```

Open the printed login URL and keep the Node console running. Its port changes each time. `npm run dev` runs a separate gateway and cannot see this fixture.

Sign in as `learner-a@example.test` with `correct-password`. Use a private browser profile for `learner-b@example.test` with the same password. These credentials work only with this fixture. Sign in before granting access to an email.

The fixed synthetic section IDs are:

| Section | ID | Reader URL suffix |
| --- | --- | --- |
| Free definition | `a524e32d-2640-4d94-a51c-000000000001` | `/account/reader.html?section=a524e32d-2640-4d94-a51c-000000000001&access=free` |
| Paid lesson | `a524e32d-2640-4d94-a51c-000000000002` | `/account/reader.html?section=a524e32d-2640-4d94-a51c-000000000002&access=paid` |

Open `/account/learning.html` and follow its section links. It reads the accessible catalog, so the paid link appears only while access is active. You can enter either reader URL directly to test denial.

## Inspect the API

On a page at the printed origin, paste this helper into the browser Console. Define it again after a full navigation.

```js
var api = async (path, body) => {
  var options = { credentials: 'same-origin', cache: 'no-store' };
  if (body !== undefined) {
    var session = await (await fetch('/api/account/session', options)).json();
    options = {
      ...options,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf },
      body: JSON.stringify(body)
    };
  }
  var response = await fetch('/api/' + path, options);
  return { status: response.status, data: await response.json() };
};
var freePath = 'sections/a524e32d-2640-4d94-a51c-000000000001/free';
var paidPath = 'sections/a524e32d-2640-4d94-a51c-000000000002/paid';
```

The browser supplies its own cookie and Origin. Filter Network requests by `/api/sections` or `/api/quizzes` while using the pages. There is no separate GET position route; each authorized section read includes its saved position.

## Check free and paid access

Before sign-in, `await api(freePath)` and `await api(paidPath)` return `401` without body text. After learner A signs in, the free read returns `200`; the paid read returns `404`. Open the free reader, scroll down its long text, wait for the save message, reload, and check that it resumes near the same place. The button labeled `שמירת מיקום הקריאה` also saves the current scroll position. The response's `position.position` is an integer from 0 to 10000.

In the Node console, grant A one hour of paid test access:

```js
await app.grant('learner-a@example.test');
```

Reload the learning page and open the paid section. It should load. A finite grant represents cancellation by ending without a renewal; it still permits reads until its end. `app.revoke` ends access immediately and is a different check.

To save a known position through the API, define the helper again on the paid reader and run:

```js
var paidRead = await api(paidPath);
var paidSave = {
  contentVersionId: paidRead.data.lesson.id,
  position: 3750,
  expectedRevision: paidRead.data.position?.revision ?? 0
};
await api(paidPath + '/position', paidSave);
```

The save returns `200` and a position of `3750`. An identical retry returns the same revision.

## Expire and renew

In the Node console:

```js
await app.expire('learner-a@example.test');
```

From A's browser, `await api(paidPath)` and `await api(paidPath + '/position', { ...paidSave, position: 5000, expectedRevision: 1 })` return `404`. `await api(freePath)` still succeeds. The paid reader clears its private text after a denied reload or tab restoration. A position read is unavailable while paid reading is denied.

Renew A within ten days:

```js
await app.grant('learner-a@example.test');
```

Reload the paid reader. An authorized `await api(paidPath)` now includes the saved `3750` position. To test expiry during an open reader, keep its tab visible while running `app.expire` from a separate terminal or console. The next save is denied and clears the private reader.

For a late renewal, expire the grant by 31 days:

```js
await app.expire('learner-a@example.test', 31);
await app.grant('learner-a@example.test');
```

The fixture backdates pre-expiry progress and attempts as well as the entitlement; it does not change the application clock. Reload the paid reader. Its authorized read now has `position: null` and starts at the top. Explicitly completed topics survive the retention deadline.

## Quiz and learner isolation

With paid access active, return to `/account/learning.html` and open the synthetic quiz. Answer its questions, navigate away and back, submit all answers, review the result, and mark the topic complete after a passing attempt. Before leaving with unsaved changes, use the page's save control. Passing requires at least 85% correct, rounded up to a whole answer: 17/20 for the default fixture. To test a different length, start a fresh fixture with `startLessonGateway({ quiz: true, quizCount: 17, longLesson: true })`; 14/17 fails and 15/17 passes. Restart an existing Node fixture to load new migrations. The fixture's quiz is test data, not course material.

Sign in as B in the separate profile. B can read the free section but cannot read the paid section or quiz until granted access. After `await app.grant('learner-b@example.test')` in Node, B's paid read starts with `position: null`. Save a position as B and reread the section as A; A's position remains separate. A request with an extra `learnerId` or `claimedPlan` field in a position POST returns `400 invalid_input`.

To test a stale save, open the same section in two signed-in windows for one learner. Read both, save one position in the first, then save a different position from the second using its old revision. The second receives `409 position_conflict`. Its reader requires an explicit reload before another save.

## Stop

In the Node console, run `await app.close()`, then `.exit`. A fresh fixture starts with empty accounts and positions.
