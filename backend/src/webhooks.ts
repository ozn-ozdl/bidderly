import { Webhook } from "svix";

import { query } from "./db.js";

type ClerkUserPayload = {
  id: string;
  email_addresses?: Array<{ email_address: string; id: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

export async function handleClerkWebhook(
  headers: Record<string, string | string[] | undefined>,
  body: string,
): Promise<{ ok: boolean; status: number }> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return { ok: false, status: 503 };
  }

  const svixId = header(headers, "svix-id");
  const svixTimestamp = header(headers, "svix-timestamp");
  const svixSignature = header(headers, "svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false, status: 400 };
  }

  const wh = new Webhook(secret);
  let event: { type: string; data: ClerkUserPayload };
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as typeof event;
  } catch {
    return { ok: false, status: 400 };
  }

  const user = event.data;
  if (event.type === "user.deleted") {
    await query("delete from users where id = $1", [user.id]);
    return { ok: true, status: 200 };
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const primaryEmail = user.email_addresses?.find(
      (e) => e.id === user.primary_email_address_id,
    )?.email_address;
    await query(
      `
        insert into users (id, email, first_name, last_name, image_url, updated_at)
        values ($1, $2, $3, $4, $5, now())
        on conflict (id) do update
          set email = excluded.email,
              first_name = excluded.first_name,
              last_name = excluded.last_name,
              image_url = excluded.image_url,
              updated_at = now()
      `,
      [
        user.id,
        primaryEmail ?? null,
        user.first_name ?? null,
        user.last_name ?? null,
        user.image_url ?? null,
      ],
    );
  }

  return { ok: true, status: 200 };
}

function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
