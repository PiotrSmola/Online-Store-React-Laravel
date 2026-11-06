/** Luhn checksum. Spaces are ignored; anything else that is not a digit fails. */
export function passesLuhn(cardNumber) {
  const digits = String(cardNumber ?? '').replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return false;

  let sum = 0;
  let double = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}
