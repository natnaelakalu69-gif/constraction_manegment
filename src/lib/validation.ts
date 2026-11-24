export const PHONE_MIN_DIGITS = 10;
export const CODE_MIN_DIGITS = 6;
/** Worker IDs are shorter than site/business codes (for example, 1025). */
export const WORKER_ID_MIN_DIGITS = 4;

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

export function isValidWorkerId(value: string): boolean {
  return new RegExp(`^\\d{${WORKER_ID_MIN_DIGITS},}$`).test(value.trim());
}

export function phoneError(label = "Phone number"): string {
  return `${label} must contain at least ${PHONE_MIN_DIGITS} digits.`;
}

export function businessCodeError(label = "Code"): string {
  return `${label} must be at least ${CODE_MIN_DIGITS} digits (numbers only).`;
}

export function workerIdError(label = "Worker ID"): string {
  return `${label} must be at least ${WORKER_ID_MIN_DIGITS} digits (numbers only).`;
}
