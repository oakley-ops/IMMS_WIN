const { previousMonthRange, isFirstBusinessDay } = require('../../../src/services/notifications/monthlyAnalytics/period');

describe('previousMonthRange', () => {
  test('mid-year: July now -> June range and label', () => {
    const { from, to, label } = previousMonthRange(new Date(2026, 6, 15)); // Jul 15 2026 (local)
    expect(label).toBe('June 2026');
    expect(from < to).toBe(true);
    // from is the June 1 local instant; its local month is June (5)
    expect(new Date(from).getMonth()).toBe(5);
    expect(new Date(from).getDate()).toBe(1);
  });

  test('January now -> December of previous year', () => {
    const { label } = previousMonthRange(new Date(2026, 0, 15)); // Jan 15 2026
    expect(label).toBe('December 2025');
  });
});

describe('isFirstBusinessDay', () => {
  // 2026 anchors (verified): Jan 1 = Thu; Mar 1 = Sun; Aug 1 = Sat.
  test('true when the 1st is a weekday and it is the 1st', () => {
    expect(isFirstBusinessDay(new Date(2026, 0, 1))).toBe(true);   // Thu Jan 1
  });
  test('false on the 2nd when the 1st was a weekday', () => {
    expect(isFirstBusinessDay(new Date(2026, 0, 2))).toBe(false);  // Fri Jan 2
  });
  test('false on a weekend first-of-month', () => {
    expect(isFirstBusinessDay(new Date(2026, 7, 1))).toBe(false);  // Sat Aug 1
    expect(isFirstBusinessDay(new Date(2026, 7, 2))).toBe(false);  // Sun Aug 2
  });
  test('true on the Monday after a weekend first-of-month', () => {
    expect(isFirstBusinessDay(new Date(2026, 7, 3))).toBe(true);   // Mon Aug 3
    expect(isFirstBusinessDay(new Date(2026, 2, 2))).toBe(true);   // Mon Mar 2 (Mar 1 = Sun)
  });
  test('false on a mid-month weekday', () => {
    expect(isFirstBusinessDay(new Date(2026, 0, 15))).toBe(false);
  });
});
