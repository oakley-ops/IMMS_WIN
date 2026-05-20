const SHIFTS = [
  { name: '1st Shift', start: '06:00', end: '14:00' },
  { name: '2nd Shift', start: '14:00', end: '22:00' },
  { name: '3rd Shift', start: '22:00', end: '06:00' },
];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function getShiftName(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  for (const shift of SHIFTS) {
    const start = toMinutes(shift.start);
    const end = toMinutes(shift.end);
    if (start < end) {
      if (minutes >= start && minutes < end) return shift.name;
    } else {
      if (minutes >= start || minutes < end) return shift.name;
    }
  }
  return null;
}

module.exports = { SHIFTS, getShiftName };
