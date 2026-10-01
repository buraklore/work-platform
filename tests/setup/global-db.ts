/**
 * Creates a fresh database for the integration suite and applies the shim + all
 * migrations, exactly like `supabase db push` would on a real project.
 */
import postgres from "postgres";
import { migrate } from "../../scripts/db-migrate";

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app_it");
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();
  await migrate(url.toString(), { shim: true, quiet: true });
}
