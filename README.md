# Imae Fatema HOTO Schedule

A simplified front-end module for HOTO scheduling using the attached DA Design System style.

## What It Does

- Shows all Jamiat HOTO schedules in one Musaedah board.
- Supports separate HOTO years, starting with `1448H`.
- Lets Musaedaat edit date, time, meeting link, status and instructions.
- Shows an Imae Fatema read-only schedule view.
- Generates a default WhatsApp-ready message for each HOTO row.
- Saves demo edits in browser `localStorage`.

## Yearly Data

Use the `HOTO Year` selector to switch between years. Super Admin can unlock the admin controls and choose `Import New Year` to upload the next year's Excel file.

The static demo stores imported years in that browser's `localStorage`. For every user/device to see new uploaded yearly data automatically, move the same year-based data model to a small backend/database.

## Open Locally

Install dependencies:

```bash
npm install
```

Run the Next.js app:

```bash
npm run dev
```

Then visit `http://localhost:3000`.

## Teable Database

This app is ready to use Teable through Next.js API routes. Create the Teable table fields listed in `TEABLE_SETUP.md`, then copy `.env.example` to `.env.local` and fill the Teable token and table ID.

Without Teable environment variables, the app falls back to local demo mode.

## Next Production Step

Deploy the Next.js app with these environment variables:

- `TEABLE_BASE_URL`
- `TEABLE_TOKEN`
- `TEABLE_HOTO_TABLE_ID`
- `HOTO_DEFAULT_YEAR`
- `SUPER_ADMIN_PASSCODE`
