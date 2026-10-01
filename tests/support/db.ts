import { sql } from "drizzle-orm";
import type { Ctx } from "@/lib/api/handler";
import { adminDb } from "@/lib/db/admin";

let counter = 0;

export async function createUser(fullName: string): Promise<Ctx & { email: string }> {
  counter += 1;
  const email = `${fullName.split(" ")[0]!.toLocaleLowerCase("tr-TR")}.${Date.now()}.${counter}@example.com`;
  const rows = (await adminDb().execute(
    sql`insert into auth.users (email, raw_user_meta_data) values (${email}, ${JSON.stringify({ full_name: fullName })}::jsonb) returning id`,
  )) as unknown as { id: string }[];
  const id = rows[0]!.id;
  return { userId: id, email, claims: { sub: id, email, role: "authenticated" } };
}

export async function raw<T = Record<string, unknown>>(query: ReturnType<typeof sql>): Promise<T[]> {
  return (await adminDb().execute(query)) as unknown as T[];
}
