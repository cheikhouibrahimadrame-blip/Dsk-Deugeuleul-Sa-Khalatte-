import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Shared Redis connection options for BullMQ queues and workers. */
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
