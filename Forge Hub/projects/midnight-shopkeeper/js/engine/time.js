export function formatShopTime(minutesAfterMidnight) {
  let total = minutesAfterMidnight % (6 * 60);
  let hour = Math.floor(total / 60);
  const min = total % 60;
  let label = 'AM';
  let displayHour = hour === 0 ? 12 : hour;
  if (displayHour > 12) displayHour -= 12;
  return `${displayHour}:${String(min).padStart(2, '0')} ${label}`;
}

export function nextTimeStep(index) {
  const base = [22, 28, 34, 41, 47, 53, 61, 38];
  return base[index % base.length];
}
