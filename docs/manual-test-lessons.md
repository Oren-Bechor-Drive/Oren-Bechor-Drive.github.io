# Manually test lesson access

Use the existing disposable test fixture to exercise the real local gateway, PostgreSQL permissions and browser screens. It uses synthetic login identities and does not connect to hosted Supabase or a payment provider. The database and saved positions last only until you close this fixture.

## Start the fixture

From the repository root, with the development dependencies installed, start the Node console:

```bash
node
```

Paste these lines at its `>` prompt:

```js
var { startLessonGateway } = await import('./tests/helpers/test-lessons.mjs');
var app = await startLessonGateway();
console.log(app.origin + '/account/test-lessons.html');
```

Open the printed URL and keep the Node console running. The port changes each time. Use this printed origin throughout; `npm run dev` starts a different gateway with different accounts.

Use a normal browser window for learner A and a private window or separate browser profile for learner B. Two ordinary tabs share login cookies. Multiple private windows may also share cookies.

| Learner | Email | Password |
| --- | --- | --- |
| A | `learner-a@example.test` | `correct-password` |
| B | `learner-b@example.test` | `correct-password` |

These credentials work only with this deterministic fixture. Sign in directly through `כניסה לחשבון`; registration and real email verification are not part of this walkthrough. Each email gets its own synthetic learner on first sign-in. Sign in before running a grant for that email.

## Prepare direct API checks

In the browser's developer tools, open Network and filter requests by `/api/lessons/`. You can inspect response status and JSON there while using the page.

For direct requests, paste this helper into the browser Console while on a page at the printed origin. Define it separately in each learner's window, and again after a full page navigation or reload:

```js
var api = async (path, body) => {
  var options = { credentials: 'same-origin', cache: 'no-store' };
  if (body !== undefined) {
    var session = await (await fetch('/api/account/session', options)).json();
    options = {
      ...options,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': session.csrf
      },
      body: JSON.stringify(body)
    };
  }
  var response = await fetch('/api/lessons/' + path, options);
  return { status: response.status, data: await response.json() };
};
```

The browser sends its own session cookie and Origin. No provider credentials are needed.

## 1. Signed-out and free access

Before signing in, run in the browser Console:

```js
await api('free');
await api('paid');
```

Both must return `401` with `{ error: 'session_expired' }`, without lesson text. The page asks you to sign in.

Sign in as learner A and return to the test lessons. The free lesson opens. The paid lesson shows an unavailable message; its direct read returns `404` with `{ error: 'lesson_unavailable' }`.

## 2. Paid access and simulated cancellation

In the Node console, grant A one hour of test access:

```js
await app.grant('learner-a@example.test');
```

In A's browser, open the paid lesson or select `ניסיון נוסף`. Enter `37.5` in `מיקום הקריאה באחוזים`, select `שמירת מיקום`, and wait for the saved message.

Cancellation simulation means leaving this grant unchanged and issuing no renewal. The existing period still allows reads and saves until its end. There is no cancellation endpoint or automatic renewal scheduler. Do not use `revoke` for cancellation; it ends access immediately.

In A's browser Console, define `api` again if necessary, then capture a valid save request for the expiry check:

```js
var reading = await api('paid');
var paidSave = {
  contentVersionId: reading.data.lesson.id,
  position: 8000,
  expectedRevision: reading.data.position.revision
};
await api('paid/position');
```

Expect `200`, with position `3750` and revision `1` on a fresh fixture. Stored positions use hundredths of a percent: `3750` means 37.5 percent.

## 3. Expiry, denied saves and retained progress

In the Node console:

```js
await app.expire('learner-a@example.test');
```

Before reloading A's browser, run:

```js
await api('paid');
await api('paid/position', paidSave);
await api('paid/position');
await api('free');
```

Expected results, in order:

1. `404`, with no paid lesson text.
2. `404`, with no position update.
3. `200`, with the original position `3750` and unchanged revision.
4. `200`, with free lesson text.

Reload the paid lesson and confirm its unavailable state. Open the free lesson and save a percentage to confirm free saving still works.

Switching away to the Node console may already clear and revalidate the browser reader. To test expiry while its save form stays visible, first renew A, open the paid lesson, and then run expiry from a terminal beside the browser without hiding its tab. The next attempted save must fail and clear the reader. Expiry does not erase text already delivered; the page rechecks on save, reload or tab restoration.

## 4. A month without renewal, then renewal

In the Node console:

```js
await app.expire('learner-a@example.test', 31);
```

This backdates the entitlement end by 31 days. It exercises the expired-access state; it does not advance the system clock or simulate a month of background jobs.

In A's browser, confirm paid reading still returns `404` and `paid/position` still returns `3750`. Then renew in the Node console:

```js
await app.grant('learner-a@example.test');
```

Open the paid lesson or select `ניסיון נוסף`. Expect the lesson text and restored `37.5` percent. Save `80`, reload, and confirm `80` returns.

## 5. Learner isolation

Sign in as learner B in the separate private window or browser profile.

Before granting B access:

- B can open the free lesson.
- B cannot open the paid lesson; `await api('paid')` returns `404`.
- `await api('paid/position')` returns `200` with `{ position: null }`. A's position must not appear.

In the Node console:

```js
await app.grant('learner-b@example.test');
```

Open B's paid lesson. It starts at `0`, with no saved position. Save `10` percent. Return to A and reload: A must still have `80`. Save `90` as A, then reload B: B must still have `10`.

To check rejected ownership selectors, run in B's browser Console:

```js
await api('paid/position?learner_id=learner-a@example.test');
var ownReading = await api('paid');
await api('paid/position', {
  contentVersionId: ownReading.data.lesson.id,
  position: 9900,
  expectedRevision: ownReading.data.position.revision,
  learnerId: 'learner-a@example.test'
});
```

Both attempts must return `400` with `invalid_input`. Ownership comes from the session; these routes accept no learner selector. Recheck A's `90` and B's `10` after the attempts.

## Stop and reset

In the Node console:

```js
await app.close();
```

Then exit Node:

```text
.exit
```

Closing the fixture removes its disposable database. Start a fresh fixture to repeat the walkthrough from empty accounts and positions.
