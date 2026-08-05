# Teable Setup

Create one Teable table for HOTO records. The app stores every Hijri year in the same table using the `Year` field.

## Required Table Fields

Use these exact field names:

- App ID
- Year
- Sr. No.
- Jamiat
- Jamaat / Mauze
- Being Handed By Zawjat of
- Being Taken By Zawjat of
- Handing Amil
- Taking Amil
- Musaedah
- Date
- Start Time
- End Time
- Time Zone
- Google Meet Link
- Instructions
- Status
- Remarks
- Last Message Sent At
- Last Updated By
- Last Updated At
- Source File

Recommended field types:

- `App ID`, `Year`, names, links, instructions, remarks / MOM: text
- `Sr. No.`: number
- `Date`: date
- `Status`: single select with `Draft`, `Scheduled`, `Completed`, `Cancelled`
- `Last Message Sent At`, `Last Updated At`: text or date/time

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

Then fill:

- `TEABLE_BASE_URL`: usually `https://app.teable.ai`
- `TEABLE_TOKEN`: Teable personal access token
- `TEABLE_HOTO_TABLE_ID`: table ID starting with `tbl`
- `SUPER_ADMIN_PASSCODE`: passcode for Super Admin controls

The Teable token must stay on the server. Do not add it to browser JavaScript.
