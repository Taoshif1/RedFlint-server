import { describe, expect, it, vi } from "vitest";

import { createDatabaseReadiness } from "../../src/config/databaseReady.js";

const createHarness = () => {
  const ping = vi.fn().mockResolvedValue({ ok: 1 });
  const mongoClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    db: vi.fn(() => ({ command: ping })),
  };
  const prepareIndexes = vi.fn().mockResolvedValue(undefined);

  return {
    ensureReady: createDatabaseReadiness({
      mongoClient,
      prepareIndexes,
    }),
    mongoClient,
    ping,
    prepareIndexes,
  };
};

describe("Database Readiness", () => {
  it("shares one successful initialization across concurrent requests", async () => {
    const { ensureReady, mongoClient, ping, prepareIndexes } = createHarness();

    await Promise.all([ensureReady(), ensureReady(), ensureReady()]);
    await ensureReady();

    expect(mongoClient.connect).toHaveBeenCalledTimes(1);
    expect(mongoClient.db).toHaveBeenCalledWith("admin");
    expect(ping).toHaveBeenCalledWith({ ping: 1 });
    expect(prepareIndexes).toHaveBeenCalledTimes(1);
  });

  it("discards a failed initialization so the next request reconnects", async () => {
    const { ensureReady, mongoClient, ping, prepareIndexes } = createHarness();
    const connectionError = new Error("TLS connection timed out");

    mongoClient.connect
      .mockRejectedValueOnce(connectionError)
      .mockResolvedValueOnce(undefined);

    await expect(ensureReady()).rejects.toThrow("TLS connection timed out");
    await expect(ensureReady()).resolves.toBeUndefined();

    expect(mongoClient.connect).toHaveBeenCalledTimes(2);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(prepareIndexes).toHaveBeenCalledTimes(1);
  });

  it("also retries when index preparation fails", async () => {
    const { ensureReady, mongoClient, prepareIndexes } = createHarness();

    prepareIndexes
      .mockRejectedValueOnce(new Error("index preparation failed"))
      .mockResolvedValueOnce(undefined);

    await expect(ensureReady()).rejects.toThrow("index preparation failed");
    await expect(ensureReady()).resolves.toBeUndefined();

    expect(mongoClient.connect).toHaveBeenCalledTimes(2);
    expect(prepareIndexes).toHaveBeenCalledTimes(2);
  });
});
