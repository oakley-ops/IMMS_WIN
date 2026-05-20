// Shift definitions — adjust start/end times to match your facility schedule
const SHIFTS = [
  { name: '1st Shift', start: '06:00', end: '14:00' },
  { name: '2nd Shift', start: '14:00', end: '22:00' },
  { name: '3rd Shift', start: '22:00', end: '06:00' },
];

function getCurrentShift() {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5); // "HH:MM"

  for (const shift of SHIFTS) {
    const { start, end } = shift;
    if (start < end) {
      if (hhmm >= start && hhmm < end) return shift.name;
    } else {
      // Overnight shift (e.g. 22:00 – 06:00)
      if (hhmm >= start || hhmm < end) return shift.name;
    }
  }
  return 'Unscheduled';
}

module.exports = { SHIFTS, getCurrentShift };
