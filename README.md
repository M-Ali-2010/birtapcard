BirTapCard — приложение на Next.js с NFC/QR аналитикой и ресторанной системой.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Supabase setup

1. Copy `.env.example` to `.env.local` and set the project URL, publishable/anon key, and server-only service-role key from Supabase Project Settings → API. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code or commit `.env.local`.
2. The live Supabase project is already initialized with BirTapCard's base schema. The restaurant migration [`supabase/migrations/20261118104931_restaurant_system.sql`](supabase/migrations/20261118104931_restaurant_system.sql) is applied and recorded in Supabase's migration history. It adds tenant-scoped restaurants, menu, tables, orders, reviews, RLS, and the synthetic Bella Italia demo.
3. Log in with an existing BirTapCard super-admin account. Open `/restaurant-admin`, select a restaurant, and use **Команда** to grant restaurant roles to existing BirTapCard accounts by email.
4. Open `/restaurant/bella-italia/table/1` to view the demo guest menu. Guest orders and till-recorded payments are not live until the migration and environment are configured.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
