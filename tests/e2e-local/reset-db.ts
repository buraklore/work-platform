/** Recreates the local end-to-end database (default app_e2e) with the shim + all migrations. */
import setup from "../setup/global-db";

process.env.TEST_DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/app_e2e";
setup().then(() => console.log(`ready: ${process.env.TEST_DATABASE_URL}`));
