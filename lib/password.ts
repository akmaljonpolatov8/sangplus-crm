import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

export function hashPassword(password: string) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, storedHash: string) {
  return bcrypt.compareSync(password, storedHash);
}
