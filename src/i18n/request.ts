import { getRequestConfig } from "next-intl/server";

// M1 ships Turkish only; en.json is kept at key parity so English can be switched on later.
export default getRequestConfig(async () => {
  const locale = "tr";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Europe/Istanbul",
  };
});
