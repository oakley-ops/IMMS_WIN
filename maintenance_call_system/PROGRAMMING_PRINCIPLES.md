# Programming Principles & System Structure

A reference for building maintainable, testable, and scalable systems. Use this as a checklist when designing new features or reviewing code.

---

## 1. Core Principles

### SOLID

| Principle | Rule | Why it matters |
|-----------|------|----------------|
| **S** — Single Responsibility | A module/class/function has one reason to change. | Keeps blast radius small; isolates failures. |
| **O** — Open/Closed | Open for extension, closed for modification. | New features shouldn't require editing tested code. |
| **L** — Liskov Substitution | Subtypes must be usable wherever the base type is. | Prevents surprise behavior in polymorphic code. |
| **I** — Interface Segregation | Many small interfaces beat one fat interface. | Callers depend only on what they use. |
| **D** — Dependency Inversion | Depend on abstractions, not concrete classes. | Enables testing, swapping implementations. |

### Other foundational principles

- **DRY (Don't Repeat Yourself)** — Knowledge should have a single source of truth. But avoid premature abstraction: 3 similar lines is fine; 3 *copies of the same logic* is not.
- **KISS (Keep It Simple, Stupid)** — Prefer the simplest solution that works. Complexity is debt.
- **YAGNI (You Aren't Gonna Need It)** — Don't build for hypothetical future needs. Build what's needed now; refactor when reality demands it.
- **Principle of Least Astonishment** — Code should behave the way a reasonable reader expects. No magic, no clever tricks.
- **Composition over Inheritance** — Build behavior by combining small pieces, not by deep class hierarchies.
- **Fail Fast** — Surface errors at the boundary they enter the system, not three layers deep.
- **Make Illegal States Unrepresentable** — Use types/enums/constraints so bad data can't exist at compile time.

---

## 2. Layered Architecture

A well-structured backend separates concerns into layers, each with a single responsibility:

```
┌─────────────────────────────────────────────┐
│  Routes / Controllers   (HTTP, validation)  │  ← thin
├─────────────────────────────────────────────┤
│  Services / Domain      (business logic)    │  ← fat
├─────────────────────────────────────────────┤
│  Repositories / DAOs    (data access)       │  ← thin
├─────────────────────────────────────────────┤
│  Database / External APIs                   │
└─────────────────────────────────────────────┘
```

### Layer responsibilities

| Layer | Owns | Does NOT own |
|-------|------|--------------|
| Routes | Parse request, validate shape, call service, format response | Business rules, SQL |
| Services | Domain logic, orchestration across repositories | HTTP details, raw SQL |
| Repositories | Queries, mapping rows ↔ domain objects | Business rules |
| Database | Persistence, constraints, indexes | Application logic |

**Rule of thumb:** A route handler should be ~10 lines. If it grows, push logic into a service.

### Frontend mirror

```
┌────────────────────────────────────────────┐
│  Pages / Routes        (composition)       │
├────────────────────────────────────────────┤
│  Components            (UI rendering)      │
├────────────────────────────────────────────┤
│  Hooks / Contexts      (state, side effects)│
├────────────────────────────────────────────┤
│  Services              (API clients)       │
├────────────────────────────────────────────┤
│  Types / Models        (shared schemas)    │
└────────────────────────────────────────────┘
```

---

## 3. Project Structure

### Backend layout

```
backend/
├── src/
│   ├── config/          # Environment loading, app config
│   ├── routes/          # HTTP route definitions (one file per resource)
│   ├── controllers/     # (optional) Request handlers, if routes get fat
│   ├── services/        # Business logic
│   ├── repositories/    # Database queries
│   ├── middleware/      # Auth, validation, error handling, logging
│   ├── database/        # Connection pool, migrations
│   ├── utils/           # Pure helpers (formatters, parsers)
│   ├── types/           # Shared TS types / JSDoc typedefs
│   └── test/            # Test setup, fixtures, helpers
├── migrations/          # SQL migration files (timestamped)
├── tests/               # Integration tests (optional separate folder)
├── index.js             # App entry point
├── package.json
└── vitest.config.js
```

### Frontend layout

```
frontend/
├── src/
│   ├── app/             # Routes (Next.js) or pages/
│   ├── components/      # Reusable UI, organized by domain
│   │   ├── common/      # Buttons, inputs, layout primitives
│   │   └── domain/      # Feature-specific components
│   ├── contexts/        # React Context providers
│   ├── hooks/           # Custom hooks
│   ├── services/        # API clients
│   ├── store/           # Redux / Zustand slices (if used)
│   ├── types/           # Shared types
│   ├── utils/           # Pure helpers
│   ├── theme/           # Styling tokens
│   └── test/            # Test setup
├── public/              # Static assets
├── package.json
└── vitest.config.ts
```

### File naming

- **One concept per file.** A 1000-line file is a code smell.
- **Match the export to the filename.** `UserCard.tsx` exports `UserCard`.
- **Use consistent casing:** PascalCase for components/classes, camelCase for utilities, kebab-case for routes/URLs.
- **Group by feature, not by type** as the codebase grows. `users/UserCard.tsx`, `users/userService.ts`, `users/types.ts` beats scattering files across `components/`, `services/`, `types/`.

---

## 4. Naming

Good names are the highest-leverage documentation you can write.

| Avoid | Prefer | Why |
|-------|--------|-----|
| `data`, `info`, `obj` | `user`, `orderItems`, `parsedToken` | Specific > generic |
| `handleClick`, `doStuff` | `handleSubmitOrder`, `recalculateTotal` | Verb + noun |
| `flag`, `mode` | `isActive`, `editMode` | Boolean prefix (`is`, `has`, `can`) |
| `temp`, `x`, `data2` | (refactor instead) | Temporary names signal unfinished thinking |
| `getUserData` | `fetchUser` (async) / `getUser` (sync) | Convey cost / latency |
| `Manager`, `Helper`, `Util` | Name what it actually does | Suffixes hide responsibility |

**Length follows scope:** a loop counter `i` is fine; a module-level variable needs a full name.

---

## 5. Functions

- **Small.** A function should fit on a screen. If it doesn't, it's doing too much.
- **One level of abstraction per function.** Don't mix high-level orchestration with low-level string parsing.
- **Few parameters.** 0–3 is ideal; 4+ usually means the parameters should be grouped into an object.
- **Pure when possible.** Same input → same output, no side effects. Pure functions are trivially testable.
- **Avoid boolean parameters.** `createUser(name, true)` — true what? Use named options or split functions.
- **Return early.** Guard clauses at the top beat deeply nested `if`s.

```js
// Avoid
function process(user) {
  if (user) {
    if (user.active) {
      // ...30 lines of logic...
    }
  }
}

// Prefer
function process(user) {
  if (!user) return;
  if (!user.active) return;
  // ...30 lines of logic, now at top level...
}
```

---

## 6. Error Handling

- **Validate at boundaries.** User input, external API responses, environment variables — validate these at the edge. Trust internal code.
- **Throw or return — pick one per layer.** Don't mix exceptions and error-return values in the same module.
- **Don't swallow errors.** `catch (e) {}` hides bugs. At minimum, log; preferably, rethrow or convert to a domain error.
- **Specific over generic.** `UserNotFoundError` beats `Error('not found')`. Specific errors enable specific handling.
- **Fail loud in development, gracefully in production.** Crash on misconfiguration locally; degrade and alert in prod.

```js
// Boundary validation
router.post('/orders', (req, res) => {
  const { userId, items } = req.body;
  if (!userId || !Array.isArray(items)) {
    return res.status(400).json({ error: 'userId and items[] required' });
  }
  // ...service call — internal layers can trust the shape now...
});
```

---

## 7. Data & State

- **Single source of truth.** Each piece of state lives in exactly one place. Derived values are computed, not stored.
- **Immutability by default.** Mutate sparingly and locally; never mutate function arguments or shared state.
- **Normalize related data.** Don't nest deeply when references work.
- **Schema at the edge.** Validate incoming JSON against a schema (Zod, Joi, JSON Schema) before it enters your domain.
- **Type your boundaries.** TypeScript interfaces / Pydantic models at API and DB layers catch contract drift early.

---

## 8. Dependencies

- **Inject, don't import.** Services receive their dependencies (db, logger, http client) as constructor args or parameters. This makes them testable.
- **Depend on interfaces, not implementations.** Code against `UserRepository`, not `PostgresUserRepository`.
- **Minimize transitive dependencies.** Each `npm install` is a security and maintenance liability.
- **Pin versions for libraries; loose-pin for apps.** Apps want bug fixes; libraries want stability for consumers.

```js
// Hard to test — service reaches out to import db
function createUser(name) {
  return db.query('INSERT INTO users ...', [name]);
}

// Easy to test — db is injected
function createUser(db, name) {
  return db.query('INSERT INTO users ...', [name]);
}
```

---

## 9. APIs (REST conventions)

- **Nouns, not verbs.** `/users/123`, not `/getUser?id=123`.
- **HTTP verbs convey intent.** GET (read), POST (create), PUT/PATCH (update), DELETE (delete).
- **Consistent status codes.** 200 OK, 201 Created, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 500 Server Error.
- **Version your API.** `/api/v1/...` from day one. Breaking changes go to v2.
- **Consistent response shapes.** Either `{ data, error }` envelope or raw payload — pick one project-wide.
- **Paginate lists.** Always. `?limit=50&offset=0` or cursor-based.

---

## 10. Security

- **Never trust input.** Validate type, length, range, format.
- **Parameterize queries.** Always use prepared statements; never concatenate user input into SQL.
- **Hash passwords with bcrypt/argon2.** Never MD5, never SHA-256 alone, never plaintext.
- **Secrets in environment variables, not in code.** Never commit `.env` files.
- **Authenticate every endpoint by default.** Make public endpoints the explicit exception.
- **Authorize with the principle of least privilege.** Users see only their own data; admins see more.
- **Rate-limit auth endpoints.** Login, registration, password reset.
- **CORS allowlist, not wildcard.** `Access-Control-Allow-Origin: *` in production is almost always wrong.
- **HTTPS everywhere.** No exceptions for "internal" services.

---

## 11. Testing

(See `TESTING.md` for the full Vitest playbook.)

- **Pyramid:** many unit tests → fewer integration tests → very few end-to-end tests.
- **Test behavior, not implementation.** Tests that assert on internal method calls break on every refactor.
- **One assertion concept per test.** Each test fails for one reason.
- **Deterministic.** No real clocks, no real network, no shared mutable state between tests.
- **Fast.** A unit test suite should run in seconds, not minutes.

---

## 12. Version Control & Code Review

### Commits

- **Small, atomic commits.** One logical change per commit.
- **Imperative present tense.** "Add user export endpoint", not "Added" or "Adds".
- **Subject line ≤ 72 chars; body explains *why*, not *what*.**

### Branches & PRs

- **Feature branches off `main`.** Short-lived (days, not weeks).
- **PRs are small.** A 200-line PR gets a thorough review; a 2000-line PR gets rubber-stamped.
- **PRs include tests.** If the change isn't testable, that's a design problem.
- **CI must be green** before merge.

### Code review checklist

- Does it do what it says it does?
- Is it covered by tests?
- Are edge cases handled? (empty, null, very large, very small, concurrent)
- Is it secure? (input validation, auth, no secrets leaked)
- Is it readable to someone joining the team next month?
- Is there a simpler way?

---

## 13. Documentation

- **README per project.** What it is, how to run it, how to test it. That's the minimum.
- **Architecture docs for non-obvious decisions.** A short markdown file explaining "why we chose Postgres over Mongo for this service" saves weeks of confusion later.
- **Comments for *why*, not *what*.** The code shows what; comments justify non-obvious choices.
- **API reference for public endpoints.** OpenAPI/Swagger is the standard.
- **Keep docs near code.** Docs in a separate repo go stale; docs alongside the code get updated with PRs.

---

## 14. Performance

Premature optimization is the root of all evil. *But* — design for the right scale from day one:

- **Index your queries.** Profile the slow ones (`EXPLAIN ANALYZE` in Postgres).
- **N+1 queries are the most common backend bug.** One query for the list, then one per item = death. Use joins or batch loads.
- **Cache the expensive, the unchanging, and the frequently-read.** Invalidate carefully — cache invalidation is one of the two hard problems in CS.
- **Paginate, don't load-all.** Never return an unbounded list.
- **Measure before optimizing.** Profile, don't guess.

---

## 15. Observability

You can't fix what you can't see:

- **Structured logging.** JSON logs with consistent fields (level, timestamp, requestId, userId). Searchable, parsable.
- **Log levels mean things.** DEBUG (dev only), INFO (normal events), WARN (something's off but handled), ERROR (failed operation), FATAL (process can't continue).
- **Correlate requests.** A request ID threaded through every log line lets you reconstruct a request's journey.
- **Metrics for what matters.** Request rate, error rate, latency (p50/p95/p99). The "RED method" (Rate, Errors, Duration).
- **Alerts on user-visible symptoms, not internal causes.** Alert on "checkout error rate > 1%", not "CPU > 80%".

---

## 16. The Boy Scout Rule

**Leave the code cleaner than you found it.** Not a refactor, just a small improvement: rename a confusing variable, delete dead code, add a missing test, fix a typo in a comment. Compounded across a team, this is how codebases stay healthy.

---

## 17. Anti-patterns to Avoid

| Anti-pattern | What it looks like | Why it hurts |
|--------------|--------------------|--------------|
| God object/file | One class/file does everything | Untestable, change ripples everywhere |
| Magic numbers/strings | `if (status === 3)` | What is 3? Use named constants. |
| Premature abstraction | Interfaces with one implementation | Adds complexity for hypothetical futures |
| Speculative generality | "I might need a plugin system later" | Build it when you need it |
| Shotgun surgery | One small feature requires editing 12 files | Indicates poor cohesion |
| Feature envy | A method uses another object's data more than its own | Move the method to that other object |
| Long parameter list | `fn(a, b, c, d, e, f, g)` | Group into an options object |
| Boolean trap | `setLocation(x, y, true)` | What does true mean? Use named options. |
| Comment as crutch | Long comment explaining tangled code | Refactor until the comment isn't needed |
| Stringly-typed | `status: string` accepting any value | Use enums/literal unions |

---

## 18. A Mental Checklist Before Merging

Before you click "merge", ask:

1. **Does it work?** Tests pass; the feature actually does what was requested.
2. **Is it tested?** Critical paths and edge cases covered.
3. **Is it secure?** Input validated; no secrets exposed; auth/authz enforced.
4. **Is it readable?** A teammate could maintain this without asking you.
5. **Is it observable?** When it breaks in production, can you tell why?
6. **Is it reversible?** If this turns out to be wrong, how hard is it to undo?
7. **Is it the simplest thing that works?** Or did you over-engineer?

If you can answer "yes" to all seven, ship it.

---

## Further Reading

- *Clean Code* — Robert C. Martin
- *The Pragmatic Programmer* — Hunt & Thomas
- *Designing Data-Intensive Applications* — Martin Kleppmann
- *Refactoring* — Martin Fowler
- *Domain-Driven Design* — Eric Evans
- *Release It!* — Michael Nygard (production hardening patterns)
