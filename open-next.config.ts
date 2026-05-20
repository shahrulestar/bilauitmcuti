import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({
  routePreloadingBehavior: "none",
});

config.default.minify = true;

export default config;
