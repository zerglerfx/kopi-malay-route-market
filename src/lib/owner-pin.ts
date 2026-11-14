/** Browser-safe Owner PIN rules shared by the PIN window and the server. */
export const PIN_RE = /^\d{6}$/;
export const isValidPin = (pin: string) => PIN_RE.test(pin);
export const isValidCode = (code: string) => /^\d{6}$/.test(code);
