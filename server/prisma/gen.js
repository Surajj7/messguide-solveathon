process.env.CHECKPOINT_DISABLE = "1";
process.env.PRISMA_TELEMETRY_INFORMATION = "0";
process.argv = [process.argv[0], "prisma", "generate"];
await import("../node_modules/prisma/build/index.js");
