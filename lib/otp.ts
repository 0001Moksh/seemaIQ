// Generate a random 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// OTP storage (in production, use Redis or database)
const otpStore: Map<string, { otp: string; expiresAt: number; attempts: number }> = new Map();

// Store OTP with 10 minute expiry
export const storeOTP = (email: string, otp: string): void => {
  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });
};

// Verify OTP
export const verifyOTP = (email: string, otp: string): boolean => {
  const stored = otpStore.get(email);

  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(email);
    return false;
  }
  if (stored.attempts >= 5) {
    otpStore.delete(email);
    return false;
  }

  stored.attempts++;

  if (stored.otp === otp) {
    otpStore.delete(email);
    return true;
  }

  return false;
};

// Clear OTP
export const clearOTP = (email: string): void => {
  otpStore.delete(email);
};
