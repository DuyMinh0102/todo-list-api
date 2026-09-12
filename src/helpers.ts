import { randomBytes, pbkdf2 } from "node:crypto";

export interface hashedPwd {
  password_hash: string;
  salt: string;
}

export interface User {
  id: number;
  username: string;
}

export const MAX_BODY_SIZE = 1e6;

export function parseCookie(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    if (name) cookies[name.trim()] = rest.join("=").trim();
  });

  return cookies;
}

export async function hashPassword(
  pwd: string,
  _salt: string = randomBytes(128).toString("base64"),
  _iterations: number = 10000,
): Promise<hashedPwd> {
  return new Promise((resolve, reject) => {
    pbkdf2(pwd, _salt, _iterations, 64, "sha512", (err, derivedKey) => {
      if (err) return reject(err);

      resolve({
        password_hash: derivedKey.toString("hex"),
        salt: _salt,
      });
    });
  });
}
