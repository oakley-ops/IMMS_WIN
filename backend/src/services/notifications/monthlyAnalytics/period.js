'use strict';

// Previous full calendar month as ISO datetime bounds + a display label.
// Computed in the server's local timezone (the plant's timezone); on a
// negative-UTC-offset host the ISO conversion keeps the correct calendar date.
function previousMonthRange(now) {
  const y = now.getFullYear();
  const m = now.getMonth();                       // 0-11, current month
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0); // first instant of last month
  const to = new Date(y, m, 0, 23, 59, 59, 999);  // day 0 of this month = last day of last month
  const label = from.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return { from: from.toISOString(), to: to.toISOString(), label };
}

// True iff `now` is the first weekday (Mon-Fri) of its calendar month.
// Holidays are not considered.
function isFirstBusinessDay(now) {
  const dow = now.getDay();               // 0=Sun .. 6=Sat
  if (dow === 0 || dow === 6) return false;
  const day = now.getDate();
  for (let d = 1; d < day; d++) {
    const earlier = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (earlier !== 0 && earlier !== 6) return false; // an earlier weekday existed
  }
  return true;
}

module.exports = { previousMonthRange, isFirstBusinessDay };
