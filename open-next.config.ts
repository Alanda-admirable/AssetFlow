import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();
config.edgeExternals = [
  ...(config.edgeExternals || []),
  "@libsql/isomorphic-ws",
  "@libsql/client",
  "@libsql/hrana-client",
];
config.cloudflare = {
  ...config.cloudflare,
  useWorkerdCondition: false,
};

export default config;
