// Normalizes Philippine mobile numbers to E.164 (+639XXXXXXXXX).
// Accepts 09XXXXXXXXX, 9XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX (spaces/dashes ignored).
function normalizePHMobile(input) {
  if (!input) return null;
  const digits = String(input).replace(/[^\d]/g, '');
  let local;
  if (/^09\d{9}$/.test(digits)) local = digits.slice(1);
  else if (/^9\d{9}$/.test(digits)) local = digits;
  else if (/^639\d{9}$/.test(digits)) local = digits.slice(2);
  else return null;
  return `+63${local}`;
}

module.exports = { normalizePHMobile };
