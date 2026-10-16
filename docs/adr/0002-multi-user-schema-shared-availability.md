# Multi-user schema with shared availability data

The app has a single real user, but every traveller-owned row (trip template, trips, routes, bookings, push subscriptions) carries a `user_id` protected by Supabase RLS, with sign-ups closed to an allow-list. Snapshot-derived availability data is global and not owned by any user. Retrofitting tenancy later would mean migrating every table and policy; doing it upfront costs little and makes the product credible as a commercial one.
