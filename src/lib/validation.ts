export const PHONE_MIN_DIGITS = 10;
export const CODE_MIN_DIGITS = 6;

export function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

export function isValidPhone(value: string): boolean {
  const phone = value.trim();
  return /^[0-9\s()+.-]+$/.test(phone) && countDigits(phone) >= PHONE_MIN_DIGITS;
}

export function isValidBusinessCode(value: string): boolean {
  return new RegExp(`^\\d{${CODE_MIN_DIGITS},}$`).test(value.trim());
}

export function phoneError(label = "Phone number"): string {
  return `${label} must contain at least ${PHONE_MIN_DIGITS} digits.`;
}

export function businessCodeError(label = "Code"): string {
  return `${label} must be at least ${CODE_MIN_DIGITS} digits (numbers only).`;
}
