import { z } from "zod";

export const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,50}$/;
export const PHONE_REGEX = /^(\+998\d{9}|998\d{9}|\d{9})$/;
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,100}$/;

export const usernameSchema = z
  .string()
  .trim()
  .regex(
    USERNAME_REGEX,
    "Username 3-50 belgi va faqat harf/raqam/._- bo'lishi kerak",
  );

export const strongPasswordSchema = z
  .string()
  .regex(
    STRONG_PASSWORD_REGEX,
    "Parol kamida 8 ta belgi, katta-kichik harf, raqam va maxsus belgi bo'lishi kerak",
  );

export const optionalPhoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Telefon formati noto'g'ri. Masalan: +998901234567")
  .optional();

export const requiredPhoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Telefon formati noto'g'ri. Masalan: +998901234567");

export const nullablePhoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Telefon formati noto'g'ri. Masalan: +998901234567")
  .nullable()
  .optional();
