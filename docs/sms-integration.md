# SMS Integration Guide

## Qanday ishlaydi

- Tizim qarzdorlarni `groupId + billingMonth` bo'yicha topadi.
- Qarzdor o'quvchilarning ota-ona raqami ro'yxati chiqadi.
- `Kechikkanlarga SMS yuborish` tugmasi bosilganda SMS jo'natiladi.
- Yuborish natijasi `Monitoring` sahifasida saqlanadi (kimga ketdi, qachon, provider, xato).

## SIM karta ulash kerakmi?

To'g'ridan-to'g'ri ownerning telefon SIM kartasini ulash odatda production uchun tavsiya etilmaydi.

To'g'ri yo'l:

- SMS provider xizmatidan foydalanish (Twilio, Eskiz, PlayMobile va boshqalar).
- Provider sizga API kalit beradi.
- Shu kalitlar `.env` ga yoziladi.

## Pullikmi?

Ha. SMS odatda pullik xizmat:

- Har yuborilgan SMS uchun narx bo'ladi.
- Narx provider va davlat bo'yicha farq qiladi.
- Ko'p providerlarda balans to'ldirish kerak bo'ladi.

## .env sozlamalari

```env
SMS_PROVIDER=generic
SMS_API_URL=https://your-sms-provider/send
SMS_API_KEY=your-provider-api-key
SMS_SENDER=SangPlus

# Twilio uchun
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=
```

`SMS_PROVIDER` qiymatlari:

- `twilio`
- `eskiz`
- `playmobile`
- `generic`

Agar sozlamalar bo'lmasa, tizim `mock` rejimda ishlaydi va yiqilmaydi.

## API endpointlar

- SMS yuborish: `POST /api/payments/reminders`
- SMS tarix: `GET /api/payments/reminders?groupId=...&billingMonth=...`

## Ishga tushirish ketma-ketligi

1. Providerdan API key oling.
2. `.env` ga yuqoridagi qiymatlarni kiriting.
3. Migration va generate qiling:

```bash
npm run db:migrate -- --name add_sms_reminder_log
npm run db:generate
```

4. Owner bilan `To'lovlar` sahifasiga kiring.
5. Guruh va oy tanlang.
6. Qarzdorlar ro'yxati va ota-ona raqamlari chiqadi.
7. `Kechikkanlarga SMS yuborish` tugmasini bosing.
8. Natijani `Monitoring` sahifasida tekshiring.
