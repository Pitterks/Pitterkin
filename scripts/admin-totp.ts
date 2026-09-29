import QRCode from "qrcode";
import { newSecret } from "../src/lib/totp";

// Run on your own machine, scan with Google Authenticator / 1Password / Authy, then set ADMIN_TOTP_SECRET.
const secret = newSecret();
const uri = `otpauth://totp/Pitterkin:admin?secret=${secret}&issuer=Pitterkin`;
console.log(await QRCode.toString(uri, { type: "terminal", small: true }));
console.log("ADMIN_TOTP_SECRET=" + secret + "\n");
