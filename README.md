# Imae Fatema HOTO Schedule

A simplified front-end module for HOTO scheduling using the attached DA Design System style.

## What It Does

- Shows all Jamiat HOTO schedules in one Musaedah board.
- Supports separate HOTO years, starting with `1448H`.
- Lets Musaedaat edit date, time, meeting link, status and instructions.
- Prevents overlapping meetings for the same Musaedah or same handover person.
- Shows an Imae Fatema read-only schedule view.
- Generates a default WhatsApp-ready message for each HOTO row.
- Stores HOTO records in Teable through server-side Next.js API routes.

## Yearly Data

Use the `HOTO Year` selector to switch between years. Super Admin can unlock the admin controls and choose `Import New Year` to upload the next year's Excel file into Teable.

The app does not bundle HOTO schedule data in the deployed code. Teable is the source of truth for shared yearly records.

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

This app uses Teable through Next.js API routes. Create the Teable table fields listed in `TEABLE_SETUP.md`, then copy `.env.example` to `.env.local` and fill the Teable token and table ID.

Without Teable environment variables, the app opens with empty local data for development.

## Next Production Step

Deploy the Next.js app with these environment variables:

- `TEABLE_BASE_URL`
- `TEABLE_TOKEN`
- `TEABLE_HOTO_TABLE_ID`
- `HOTO_DEFAULT_YEAR`
- `SUPER_ADMIN_PASSCODE`
