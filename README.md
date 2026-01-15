# Certificate Management System

This is a minimal Certificate Management System with role-based access (Admin, Student, Management).

Quick start

1. Install dependencies

```powershell
npm install
```

2. Seed the database

```powershell
npm run seed
```

3. Start the server

```powershell
npm start
```

Open http://localhost:3000

Default seeded accounts:

- Admin: admin@example.com / adminpass
- Management: management@example.com / managepass
- Student: student1@example.com / studentpass

Notes

- Server uses a simple JWT cookie (set `JWT_SECRET` env var for production).
- Only `ADMIN` may create/update certificate data and decide requests.
- All issue/return actions are recorded in the `logs` table for auditing.
