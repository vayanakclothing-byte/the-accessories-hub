# Connecting Supabase

The storefront is a static site, so all data access happens from the browser
with your project's **anon public** key. `supabase/schema.sql` creates the
tables, enables row level security and adds the one function anonymous
visitors are allowed to call.

## 1. Create the project

<https://supabase.com/dashboard> → **New project**. A restored project works
too, but its ref (the `xxxx.supabase.co` subdomain) must match what you paste
in step 3.

## 2. Run the schema

Project → **SQL Editor** → **New query** → paste all of `supabase/schema.sql` →
**Run**. It is idempotent, so re-running it is safe.

> **Do this first.** The live project currently has row level security
off/permissive: `https://hefijdydpibqbubjrnli.supabase.co/rest/v1/customers`
returns customer names and phone numbers to anyone holding the public anon
key, and `orders` is readable the same way. Running this file closes that,
and also installs `place_order()`, which checkout needs.

That creates:

| table | who can read | who can write |
|---|---|---|
| `products` | everyone | admins |
| `customers`, `orders`, `order_items`, `invoices`, `stock_history`, `settings` | admins | admins |
| `profiles` | you (your own row) and admins | admins |

Guest checkout does not touch those tables directly: it calls
`place_order(...)`, a `SECURITY DEFINER` function that re-reads prices and
stock from the database, then writes the customer, order, line items and stock
movement in one transaction. A tampered browser cart cannot change the total,
and no anonymous visitor can read customer rows.

## 3. Credentials

The client is already pointed at project `hefijdydpibqbubjrnli`. If you move
to a different project, replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` in
[`js/supabase-client.js`](../js/supabase-client.js) with the **Project URL**
and **anon public** key from Dashboard → Settings → API.

Both values are public by design. Never put the `service_role` key in client
code.

## 4. Make yourself an admin

Sign in to the site once (Google or email), then in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'theaccessorieshub2530@gmail.com';
```

Reload `/admin/` — the dashboard should open instead of the "access required"
page.

## 5. Check it works

1. Storefront: products appear and no yellow "demo mode" banner is shown.
2. Place a test order → it appears in Admin → Sales with status **pending**.
3. Admin → Inventory: the stock for the ordered item went down.
4. Signed out, try `https://<your-project>.supabase.co/rest/v1/customers?select=*`
   with only the anon key — it must return an empty array, not customer data.

## Demo mode

If the project is unreachable (or the credentials are still placeholders), the
site falls back to a browser-local mock so the UI stays usable. That mode is
labelled with a banner and checkout says plainly that the order was not saved.
To force it for UI work, append `?mock=true` to any page.
