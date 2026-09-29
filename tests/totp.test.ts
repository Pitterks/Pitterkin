import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, newSecret, totp, verifyTotp } from "@/lib/totp";

// RFC 6238 Appendix B, SHA-1 secret "12345678901234567890"
const RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 test vectors (last 6 digits)", () => {
    expect(totp(RFC, 59_000)).toBe("287082");
    expect(totp(RFC, 1111111109_000)).toBe("081804");
    expect(totp(RFC, 1234567890_000)).toBe("005924");
    expect(totp(RFC, 2000000000_000)).toBe("279037");
  });
  it("base32 round-trips", () => {
    const s = newSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(() => base32Decode("!!!")).toThrow();
  });
  it("accepts adjacent windows only, and only 6-digit codes", () => {
    const t = 1_700_000_000_000;
    const c = totp(RFC, t);
    expect(verifyTotp(RFC, c, t)).toBe(true);
    expect(verifyTotp(RFC, c, t + 30_000)).toBe(true);
    expect(verifyTotp(RFC, c, t + 95_000)).toBe(false);
    expect(verifyTotp(RFC, "12345", t)).toBe(false);
    expect(verifyTotp(RFC, "abcdef", t)).toBe(false);
  });
});
