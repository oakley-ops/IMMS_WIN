const { computeTransitions } = require('../../../src/observability/uptimeCheck');

test('first observation: all up -> no transitions, states recorded', () => {
  const { transitions, states } = computeTransitions({}, [{ url: 'a', up: true }, { url: 'b', up: true }]);
  expect(transitions).toEqual([]);
  expect(states).toEqual({ a: true, b: true });
});

test('first observation: a down URL alerts immediately', () => {
  const { transitions, states } = computeTransitions({}, [{ url: 'a', up: false }]);
  expect(transitions).toEqual([{ url: 'a', up: false }]);
  expect(states).toEqual({ a: false });
});

test('steady up -> no transition', () => {
  const { transitions } = computeTransitions({ a: true }, [{ url: 'a', up: true }]);
  expect(transitions).toEqual([]);
});

test('up -> down transition', () => {
  const { transitions, states } = computeTransitions({ a: true }, [{ url: 'a', up: false }]);
  expect(transitions).toEqual([{ url: 'a', up: false }]);
  expect(states.a).toBe(false);
});

test('down -> up recovery transition', () => {
  const { transitions } = computeTransitions({ a: false }, [{ url: 'a', up: true }]);
  expect(transitions).toEqual([{ url: 'a', up: true }]);
});

test('mixed: only the changed URL transitions', () => {
  const { transitions } = computeTransitions({ a: true, b: true }, [{ url: 'a', up: true }, { url: 'b', up: false }]);
  expect(transitions).toEqual([{ url: 'b', up: false }]);
});
