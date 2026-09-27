# Smart RO Emergency Rescue Coordination Dashboard

This project is a Next.js emergency response mini-application with three roles: User, Admin, and Rescue Team. It demonstrates SOS submission, emergency triage, admin management, AI-assisted matching, and rescue-team operations in a single local demo environment.

## Features

- User login and SOS trigger workflow
- Emergency type selection and geolocation capture
- Admin dashboard with active emergency management
- Rescue resource CRUD and monitoring
- Rescue team dashboard with assignment alerts and status updates
- Gemini-backed team matching using facts from the database only
- SQLite seed data for realistic local demo flow
- Responsive dashboard UI built with Next.js App Router and Tailwind

## Tech stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite for local development
- Gemini API via server-side calls only
- Leaflet + OpenStreetMap for map display

## Environment variables

Create a .env file from .env.example and fill in values:

```bash
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_MAP_API_KEY=""
GEMINI_API_KEY=""
NEXTAUTH_SECRET="demo-secret-change-me"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Local setup

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Then open http://localhost:3000

## Demo login users

- User: user@example.com / password123
- Admin: admin@rescue.com / admin123
- Rescue Team A: team-a@rescue.com / team123

## Database tools

```bash
npx prisma db push
npm run db:seed
```

The demo seed **clears and rebuilds the local demo database**. It creates 650 emergency records distributed around Tamil Nadu, 36 users, 15 rescue teams, 120 resource records, assignment history, and admin notification records. Do not run `npm run db:seed` if you need to preserve records you entered manually.

## Gemini setup

1. Create a Gemini API key in Google AI Studio.
2. Add it to GEMINI_API_KEY in .env.
3. The app sends only validated structured payloads from the backend to Gemini.
4. When the key is missing, the app gracefully falls back to admin review required instead of inventing an assignment.

## Production build

```bash
npm run build
npm run start
```

## Demo workflow

1. Login as User.
2. Select Flood and trigger SOS.
3. Allow browser geolocation.
4. Emergency is stored in the local database.
5. Admin sees the emergency request in the admin dashboard.
6. Backend fetches teams/resources and validates them.
7. Backend calls Gemini for team recommendation.
8. Rescue assignment is created when the recommended team is valid.
9. Rescue team dashboard receives the alert.
10. User sees the assigned status and response workflow updates.

## Notes

- The app exposes no secret keys in frontend code.
- The admin, rescue, and user routes are protected server-side.
- The AI layer is isolated from database access and only receives sanitized structured data.
