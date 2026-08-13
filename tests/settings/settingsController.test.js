import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  settingsCollection: {
    findOne: mocks.findOne,
    updateOne: mocks.updateOne,
  },
}));

import {
  getSettings,
  updateSettings,
} from "../../src/controllers/settingsController.js";
import { DEFAULT_PAYMENT_METHODS } from "../../src/utils/storeSettings.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

const validSettings = {
  storeName: "RedFlint",
  supportEmail: "support@redflint.com",
  supportPhone: "01712345678",
  whatsappNumber: "8801712345678",
  messengerLink: "https://m.me/redflintbd",
  currency: "BDT",
  shippingFee: 120,
  freeShipping: 3000,
  maintenanceMode: false,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};

describe("Settings Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe defaults when store settings do not exist", async () => {
    mocks.findOne.mockResolvedValue(null);

    const res = createResponse();
    await getSettings({}, res);

    expect(mocks.findOne).toHaveBeenCalledWith({ _id: "store" });
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "store",
        storeName: "RedFlint",
        currency: "BDT",
        shippingFee: 120,
        freeShipping: 3000,
        maintenanceMode: false,
        paymentMethods: expect.objectContaining({
          cod: expect.objectContaining({
            enabled: true,
            requiresTransactionId: false,
          }),
        }),
      }),
    );
  });

  it("does not expose unexpected fields from a legacy settings document", async () => {
    mocks.findOne.mockResolvedValue({
      ...validSettings,
      internalApiKey: "must-not-leak",
      paymentMethods: {
        ...validSettings.paymentMethods,
        bkash: {
          ...validSettings.paymentMethods.bkash,
          privateNote: "must-not-leak",
        },
      },
    });

    const res = createResponse();
    await getSettings({}, res);

    const response = res.send.mock.calls[0][0];
    expect(response).not.toHaveProperty("internalApiKey");
    expect(response.paymentMethods.bkash).not.toHaveProperty("privateNote");
  });

  it("whitelists and saves validated payment settings", async () => {
    mocks.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mocks.findOne.mockResolvedValue({ _id: "store", ...validSettings });

    const req = { body: validSettings };
    const res = createResponse();

    await updateSettings(req, res);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: "store" },
      {
        $set: expect.objectContaining({
          storeName: "RedFlint",
          currency: "BDT",
          paymentMethods: expect.objectContaining({
            bkash: expect.objectContaining({
              enabled: false,
              accountNumber: "",
            }),
            cod: expect.objectContaining({ requiresTransactionId: false }),
          }),
          updatedAt: expect.any(Date),
        }),
        $setOnInsert: { createdAt: expect.any(Date) },
      },
      { upsert: true },
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        settings: expect.objectContaining({ storeName: "RedFlint" }),
      }),
    );
  });

  it("rejects unexpected fields instead of allowing settings mass assignment", async () => {
    const req = {
      body: {
        ...validSettings,
        adminOverride: true,
      },
    };
    const res = createResponse();

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Unsupported settings field: adminOverride.",
    });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("requires at least one enabled payment method", async () => {
    const paymentMethods = Object.fromEntries(
      Object.entries(DEFAULT_PAYMENT_METHODS).map(([key, method]) => [
        key,
        { ...method, enabled: false },
      ]),
    );
    const req = { body: { ...validSettings, paymentMethods } };
    const res = createResponse();

    await updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "At least one payment method must be enabled.",
    });
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });
});
