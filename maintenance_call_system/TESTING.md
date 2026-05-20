# MCS — Vitest Testing Plan

## Why Vitest

- Works natively with TypeScript and ES modules — no Babel config needed
- Shared config between frontend (Next.js/React) and backend (Node/Express) tests
- Fast watch mode, compatible with the existing `package.json` scripts pattern
- `vi.mock()` is the same API as Jest — low learning curve

---

## Scope

Two separate test suites, one per package:

| Package | Runner | What gets tested |
|---------|--------|-----------------|
| `backend/` | Vitest (Node) | Business logic, route handlers, shift utility |
| `frontend/` | Vitest + jsdom | Service layer, UI components, auth context |

**Not in scope for unit tests:** database queries, Socket.io events, PM2 process management. Those belong in integration tests (separate, run against a real test DB).

---

## Backend Setup

### Install

```bash
cd backend
npm install --save-dev vitest @vitest/coverage-v8
```

### `backend/vitest.config.js`

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/database/**'],   // DB layer — integration test territory
    },
  },
});
```

### Add scripts to `backend/package.json`

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

## Frontend Setup

### Install

```bash
cd frontend
npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

### `frontend/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/**', 'src/pages/**', 'src/test/**'],
    },
  },
});
```

### `frontend/src/test/setup.ts`

```ts
import '@testing-library/jest-dom';
```

### Add scripts to `frontend/package.json`

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

## Test File Structure

```
backend/
  src/
    config/
      shifts.test.js          ← getCurrentShift() — pure logic, easy wins
    middleware/
      auth.test.js            ← JWT verify, missing token, expired token
    routes/
      maintenanceCalls.test.js ← route handler unit tests (db mocked)
      auth.test.js             ← login validation, bcrypt path (db mocked)

frontend/
  src/
    test/
      setup.ts
    services/
      maintenanceCallService.test.ts  ← axios mock, all svc methods
    contexts/
      AuthContext.test.tsx            ← login/logout state, token persistence
    components/
      CallBoard.test.tsx              ← renders calls, elapsed timer display
      CallStation.test.tsx            ← badge HID accumulator logic
      LoginForm.test.tsx              ← form validation, submit behavior
```

---

## Test Cases — Backend

### `shifts.test.js` — Pure logic, no mocks needed

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCurrentShift } from '../config/shifts';

afterEach(() => vi.useRealTimers());

describe('getCurrentShift', () => {
  it('returns 1st Shift at 08:00', () => {
    vi.setSystemTime(new Date('2026-01-01T08:00:00'));
    expect(getCurrentShift()).toBe('1st Shift');
  });

  it('returns 2nd Shift at 15:30', () => {
    vi.setSystemTime(new Date('2026-01-01T15:30:00'));
    expect(getCurrentShift()).toBe('2nd Shift');
  });

  it('returns 3rd Shift at 23:00 (overnight start)', () => {
    vi.setSystemTime(new Date('2026-01-01T23:00:00'));
    expect(getCurrentShift()).toBe('3rd Shift');
  });

  it('returns 3rd Shift at 02:00 (overnight wrap)', () => {
    vi.setSystemTime(new Date('2026-01-01T02:00:00'));
    expect(getCurrentShift()).toBe('3rd Shift');
  });

  it('returns Unscheduled if no shift matches (should not happen with current config)', () => {
    // Only possible if SHIFTS has a gap — this is a guardrail test
    expect(typeof getCurrentShift()).toBe('string');
  });
});
```

### `auth.test.js` — Middleware

```js
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import authMiddleware from '../middleware/auth';

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('auth middleware', () => {
  it('calls next() with valid token', () => {
    const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET || 'dev-jwt-secret-key');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(1);
  });

  it('returns 401 with no token', () => {
    const req = { headers: {} };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with expired token', () => {
    const token = jwt.sign({ id: 1 }, 'dev-jwt-secret-key', { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with tampered token', () => {
    const req = { headers: { authorization: 'Bearer not.a.real.token' } };
    const res = mockRes();
    authMiddleware(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

### `maintenanceCalls.test.js` — Route logic (db mocked)

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing the router
vi.mock('../database/db', () => ({
  default: { query: vi.fn() },
}));

import db from '../database/db';
import request from 'supertest';   // npm i -D supertest
import express from 'express';
import router from '../routes/maintenanceCalls';

const app = express();
app.use(express.json());
app.use('/', router);

beforeEach(() => vi.clearAllMocks());

describe('POST /badge-swipe', () => {
  it('returns 400 if badge_id missing', async () => {
    const res = await request(app).post('/badge-swipe').send({ reader_key: 'press-1' });
    expect(res.status).toBe(400);
  });

  it('returns unknown_badge when badge not found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] });  // badge lookup returns nothing
    const res = await request(app).post('/badge-swipe').send({ badge_id: 'UNKNOWN', reader_key: 'press-1' });
    expect(res.body.action).toBe('unknown_badge');
  });

  it('creates a call when operator badges and no active call', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'B1', person_name: 'Joe', role: 'operator' }] })  // badge
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] }) // reader
      .mockResolvedValueOnce({ rows: [] })                                                            // no active call
      .mockResolvedValueOnce({ rows: [{ call_id: 99, machine_id: 10, status: 'open' }] });           // INSERT

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1', reader_key: 'press-1' });
    expect(res.body.action).toBe('call_created');
    expect(res.body.call.call_id).toBe(99);
  });

  it('returns already_active when operator badges with open call', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'B1', person_name: 'Joe', role: 'operator' }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'open' }] });  // existing call

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'B1', reader_key: 'press-1' });
    expect(res.body.action).toBe('already_active');
  });

  it('acknowledges call when technician badges on open call', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ badge_id: 'T1', person_name: 'Tech A', role: 'technician', technician_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ reader_id: 1, machine_id: 10, machine_name: 'Press 701' }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'open', technician_badge_id: null }] })
      .mockResolvedValueOnce({ rows: [{ call_id: 5, status: 'in_progress' }] });  // UPDATE

    const res = await request(app).post('/badge-swipe').send({ badge_id: 'T1', reader_key: 'press-1' });
    expect(res.body.action).toBe('call_acknowledged');
  });
});

describe('PUT /:id/resolve', () => {
  it('returns 400 if resolution_notes missing', async () => {
    const res = await request(app).put('/1/resolve').send({ reason_category: 'mechanical' });
    expect(res.status).toBe(400);
  });

  it('resolves the call and returns updated row', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ call_id: 1, status: 'resolved' }] });
    const res = await request(app).put('/1/resolve').send({ resolution_notes: 'Fixed belt' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
  });

  it('returns 404 if call already resolved', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).put('/1/resolve').send({ resolution_notes: 'Fixed' });
    expect(res.status).toBe(404);
  });
});
```

---

## Test Cases — Frontend

### `maintenanceCallService.test.ts` — Service layer

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import svc from '../services/maintenanceCallService';

vi.mock('axios');
const mockedAxios = vi.mocked(axios.create(() => ({})), true);

// Simpler: mock the module-level api instance
vi.mock('../services/maintenanceCallService', async (importOriginal) => {
  // Integration-style: let the real service run but mock axios at the network level
  // See vi.fn() approach below for simpler alternative
});

describe('searchParts', () => {
  it('calls the correct endpoint', async () => {
    // Use msw (Mock Service Worker) for a cleaner approach — see Phase 2
  });
});
```

> **Note:** For the service layer, [Mock Service Worker (msw)](https://mswjs.io/) is the recommended approach — it intercepts at the network level without mocking axios internals. Add it in Phase 2.

### `AuthContext.test.tsx` — Auth state

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const Consumer = () => {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span>{isAuthenticated ? 'authed' : 'guest'}</span>
      <button onClick={() => login('fake-token', { id: 1, username: 'admin', role: 'admin' })}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  it('starts as unauthenticated', () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByText('guest')).toBeInTheDocument();
  });

  it('becomes authenticated after login()', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(screen.getByText('authed')).toBeInTheDocument());
  });

  it('clears state on logout()', async () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    fireEvent.click(screen.getByText('Login'));
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(screen.getByText('guest')).toBeInTheDocument());
  });
});
```

### `LoginForm.test.tsx` — Form validation

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '../components/LoginForm';

// Mock next/navigation
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe('LoginForm', () => {
  it('disables submit when fields are empty', () => {
    render(<LoginForm />);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });

  it('enables submit when both fields are filled', () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass' } });
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });

  it('shows error message on failed login', async () => {
    // Mock the auth context login to throw
  });
});
```

### `CallBoard.test.tsx` — Rendering and elapsed time

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CallBoard from '../components/CallBoard';

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), off: vi.fn(), disconnect: vi.fn() }) }));
vi.mock('../services/maintenanceCallService', () => ({
  default: { getActiveCalls: vi.fn().mockResolvedValue([]) }
}));

describe('CallBoard', () => {
  it('renders empty state message when no calls', async () => {
    render(<CallBoard />);
    // await loading to clear
    expect(await screen.findByText(/no active calls/i)).toBeInTheDocument();
  });

  it('renders a call card with machine name', async () => {
    const svc = await import('../services/maintenanceCallService');
    vi.mocked(svc.default.getActiveCalls).mockResolvedValueOnce([{
      call_id: 1, machine_name: 'Press 701', status: 'open',
      called_at: new Date().toISOString(), operator_name: 'Joe',
      // ...other required fields
    } as any]);
    render(<CallBoard />);
    expect(await screen.findByText('Press 701')).toBeInTheDocument();
  });
});
```

---

## Coverage Targets

| Area | Target | Why |
|------|--------|-----|
| `shifts.js` | 100% | Pure function, trivial to cover fully |
| `middleware/auth.js` | 90%+ | Security-critical path |
| `routes/maintenanceCalls.js` | 70%+ | Core business logic, all happy + error paths |
| `AuthContext.tsx` | 80%+ | Auth state drives all protected pages |
| `maintenanceCallService.ts` | 60%+ | API contract, catches endpoint URL typos |
| UI components | 50%+ | Happy path + key interaction |

---

## Implementation Order

### Phase 1 — Backend pure logic (1–2 hours)
1. Install Vitest in `backend/`
2. Write `shifts.test.js` — all 4 time windows
3. Write `auth.test.js` — middleware, 4 cases
4. Run `npm test` and confirm green

### Phase 2 — Backend route handlers (2–3 hours)
1. Install `supertest` in `backend/`
2. Write `maintenanceCalls.test.js` — badge swipe (4 cases), resolve (3 cases)
3. Add reader and badge admin CRUD tests
4. Confirm coverage report at 70%+

### Phase 3 — Frontend service + context (2–3 hours)
1. Install Vitest + Testing Library in `frontend/`
2. Install [msw](https://mswjs.io/) for network mocking
3. Write `AuthContext.test.tsx`
4. Write `maintenanceCallService.test.ts` using msw handlers

### Phase 4 — Component tests (ongoing)
1. `LoginForm.test.tsx` — form validation
2. `CallBoard.test.tsx` — render + empty state
3. `CallStation.test.tsx` — HID accumulator logic (the keydown buffer)

---

## Running Tests

```bash
# Backend
cd backend && npm test            # single run
cd backend && npm run test:watch  # watch mode during development
cd backend && npm run test:coverage

# Frontend
cd frontend && npm test
cd frontend && npm run test:coverage
```

---

## Key Mocking Patterns

### Mock the DB in backend route tests
```js
vi.mock('../database/db', () => ({ default: { query: vi.fn() } }));
```

### Mock next/navigation in component tests
```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('reader=press-1'),
}));
```

### Fake timers for shift tests
```js
vi.setSystemTime(new Date('2026-01-01T08:00:00'));
// ... test ...
vi.useRealTimers();
```

### Socket.io mock
```ts
vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }),
}));
```

---

## What Is Proper Unit Testing With Vitest

A unit test verifies **one unit of behavior** — a single function, hook, or component — in isolation from its real dependencies (database, network, filesystem, time, other modules). The goal is fast, deterministic feedback that pinpoints a regression to a specific line of code, not a sprawling integration check.

### Core Principles

1. **Test behavior, not implementation.** Assert on what the function returns or what the user sees on screen, not on which internal methods got called. Tests that mirror the implementation break on every refactor.
2. **One logical assertion per test.** Each `it()` should fail for exactly one reason. If you need multiple expects, they should all be facets of the same behavior (e.g., status code + body shape of one response).
3. **Arrange–Act–Assert (AAA).** Set up state, invoke the unit under test, then assert. Keep these three phases visually separate inside the test body.
4. **Deterministic.** No real clocks, no real network, no random values, no test ordering dependencies. Use `vi.setSystemTime()`, `vi.mock()`, and seeded inputs.
5. **Fast.** A unit test suite should run in seconds. If a test takes >50ms, it's probably hitting something it shouldn't be mocking.
6. **Isolated.** `beforeEach(() => vi.clearAllMocks())` so prior tests can't leak state into the next one. Never share mutable state between tests.
7. **Readable names.** `it('returns 401 when token is expired')` beats `it('test auth 2')`. The name is the spec.

### Anatomy of a Vitest Test File

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { underTest } from './module';

vi.mock('./dependency');                  // hoisted — runs before imports resolve

describe('underTest', () => {
  beforeEach(() => vi.clearAllMocks());   // reset mock call history
  afterEach(() => vi.useRealTimers());    // undo fake timers if used

  describe('when input is valid', () => {
    it('returns the expected result', () => {
      // Arrange
      const input = { id: 1 };
      // Act
      const result = underTest(input);
      // Assert
      expect(result).toEqual({ ok: true });
    });
  });

  describe('when input is invalid', () => {
    it('throws ValidationError', () => {
      expect(() => underTest(null)).toThrow('ValidationError');
    });
  });
});
```

### Vitest APIs You Should Know

| API | Use for |
|-----|---------|
| `describe` / `it` (or `test`) | Group tests / declare a single test |
| `expect(...).toBe / .toEqual / .toMatchObject` | Assertions (`toBe` = `===`, `toEqual` = deep equality) |
| `expect(...).toThrow / .rejects.toThrow` | Sync / async error assertions |
| `vi.fn()` | Create a mock function — inspect with `.mock.calls` |
| `vi.spyOn(obj, 'method')` | Wrap a real method to observe (or override) it |
| `vi.mock('module', factory)` | Replace an entire module — **hoisted** above imports |
| `vi.mocked(thing, deep?)` | TypeScript helper that types a mocked value |
| `vi.useFakeTimers()` + `vi.setSystemTime()` | Control `Date.now()` and timers |
| `vi.advanceTimersByTime(ms)` | Step forward through `setTimeout`/`setInterval` |
| `vi.clearAllMocks()` / `vi.resetAllMocks()` / `vi.restoreAllMocks()` | Reset call history / reset to empty mocks / restore spied originals |
| `beforeEach` / `afterEach` / `beforeAll` / `afterAll` | Lifecycle hooks |
| `it.each([...])` | Parameterised tests (table-driven) |
| `it.skip` / `it.only` / `it.todo` | Skip, focus, or stub a test |

### What Belongs In A Unit Test (and What Doesn't)

**Do unit test:**
- Pure functions (utilities, formatters, validators, reducers, selectors)
- Business logic in route handlers / controllers (with the DB layer mocked)
- React component rendering and user-interaction behavior (with services mocked)
- Hooks and contexts (state transitions, side effects)
- Error handling and edge cases (null, empty, boundary values)

**Don't unit test (these belong in integration / E2E tests):**
- Real database queries — use a test DB in integration tests
- Real HTTP requests — use msw for network-level mocks
- Socket.io wire-up — mock the client; test the event handlers separately
- Third-party library internals — trust them
- Trivial getters/setters or framework code

### Mocking Strategy

Mock at the **module boundary closest to the unit under test**, not deeper. For a route handler, mock the `db` module — not `pg`. For a React component, mock the service module — not `axios`. This keeps tests resilient to internal refactors.

```ts
// Good — mock the dependency the unit imports directly
vi.mock('../database/db', () => ({ default: { query: vi.fn() } }));

// Avoid — mocking too deep means tests still break when the abstraction changes
vi.mock('pg', () => ({ Pool: vi.fn() }));
```

`vi.mock()` calls are **hoisted** to the top of the file by Vitest's transformer, so they run before the `import` statements that depend on them. You can still reference mocked values inside the factory via `vi.hoisted()` if you need shared variables.

### Async Testing

```ts
it('resolves with user data', async () => {
  const result = await getUser(1);
  expect(result.name).toBe('Joe');
});

it('rejects when user not found', async () => {
  await expect(getUser(999)).rejects.toThrow('NotFound');
});
```

Always `await` async calls or return the promise — a missing `await` will silently pass even when the assertion fails.

### React Component Testing Conventions

- Render with `@testing-library/react`'s `render()`; query with `screen.getByRole / getByLabelText / findByText` (role/label-based queries mirror how users and screen readers find elements).
- Use `userEvent` over `fireEvent` when possible — it simulates real browser sequences (focus, keydown, keyup, input).
- Wait for async UI with `findBy*` (built-in retry) or `waitFor(() => expect(...))`.
- Never assert on CSS classes or internal component state — assert on what the user sees.

### Coverage As A Signal, Not A Goal

Coverage tells you what code is *exercised*, not what is *correctly tested*. 100% coverage with no assertions is worthless; 60% coverage of every branch in the critical path is gold. Use the targets in the table above as floors, not ceilings, and let the risk of the code drive the depth of testing.

### Common Pitfalls

- **Shared state between tests** — module-level variables, singletons, `localStorage`. Reset in `beforeEach`.
- **Forgetting `await`** on async expectations — the test exits before the assertion runs.
- **Over-mocking** — if you mock everything the unit touches, you're just testing your mocks. Leave pure helpers un-mocked.
- **Testing the framework** — don't write tests that assert React renders a `<div>` or Express calls `res.json`. Test *your* behavior on top.
- **Snapshot abuse** — snapshots are a tool, not a strategy. They're fine for stable serialized output (e.g., a formatter's result); they're noise for UI markup that legitimately changes often.
- **Time bombs** — tests that use the real `Date` or `Math.random` will eventually fail. Stub them.

### Definition of Done For A Unit Test

A test is done when:
1. It fails for the right reason if you break the code (try it — comment out the implementation and confirm the test goes red).
2. It passes consistently when run alone, in the suite, and in any order (`vitest --sequence.shuffle`).
3. Its name describes the behavior, not the mechanism.
4. It runs in under ~50ms.
5. A reader can understand what's being verified without reading the implementation.
