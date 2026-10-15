# Biller account setup

## First administrator

The first administrator must be granted access from the Supabase project dashboard. Shop users cannot sign themselves up or promote themselves to administrator.

1. In Supabase Authentication, create a confirmed user with the administrator's email and password.
2. Copy that Auth user's UUID.
3. In the SQL editor, run this statement with the UUID:

   ```sql
   insert into public.app_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

4. Turn off public user sign-ups in the Auth settings. The Biller administrator page creates shop users through a server-side Edge Function.
5. Select **Admin login** in Biller and sign in with that email/password.

On the first administrator sign-in, Biller asks you to enroll an authenticator. Scan the QR code with Google Authenticator (or another TOTP app), then enter the six-digit code to finish setup. Later administrator sign-ins require a fresh authenticator code after the email and password. Administrator data access is denied by both Row Level Security and the admin Edge Function until the session reaches Supabase AAL2.

If the administrator loses access to the authenticator, a Supabase project owner must remove the lost factor from that Auth user in the Supabase dashboard. The next admin login can enroll a replacement.

The administrator account is separate from each shop's ID and user logins. Keep the administrator password private.

## Add shops and users

In **Biller administration**, create a shop by entering its name, Shop ID, first owner User ID, and an initial password. The owner can use those credentials on the **Shop user** login tab. Add additional staff logins from the shop card. An administrator can disable a login, reset its password, or suspend a shop.

Shop IDs are 2–20 lowercase letters, numbers, or hyphens. User IDs are 3–32 lowercase letters, numbers, dots, underscores, or hyphens. Passwords must be at least 8 characters.

## Shop data isolation

Products, invoices, settings, custom units, and activity entries are associated with a shop UUID. Supabase Row Level Security checks active membership and shop status on every database request. The browser uses only the project's publishable key; the Auth Admin API is called from the protected `admin-manage` Edge Function.

## Import existing device data

On the first run after this upgrade, existing IndexedDB products, invoices, settings, and custom units are copied into a local archive before the active cache is switched to Supabase. An administrator can import that archive into a selected shop from the administration page. The import is available only for a shop with no existing products or invoices. Once imported, the local archive is cleared.

## Environment

Copy `.env.example` to `.env.local`, then set the Supabase project URL and publishable key. Do not put a `service_role` or secret key in any `VITE_` variable.
