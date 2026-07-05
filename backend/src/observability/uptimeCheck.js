'use strict';

// Pure: given previous up/down states and this round's results, return the
// transitions worth alerting on plus the updated states. No I/O.
//   prevStates: { [url]: boolean }
//   results:    [{ url, up: boolean }]
//   returns:    { transitions: [{ url, up }], states: { [url]: boolean } }
// First observation of a URL alerts only if it is DOWN (so a service already
// down when the monitor starts is surfaced); an already-up URL is recorded
// silently.
function computeTransitions(prevStates, results) {
  const states = { ...prevStates };
  const transitions = [];
  for (const { url, up } of results) {
    const prev = prevStates[url];
    if (prev === undefined) {
      states[url] = up;
      if (!up) transitions.push({ url, up: false });
    } else if (prev !== up) {
      states[url] = up;
      transitions.push({ url, up });
    }
  }
  return { transitions, states };
}

module.exports = { computeTransitions };
