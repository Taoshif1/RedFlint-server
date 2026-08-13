import { beforeEach, describe, expect, it, vi } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  settingsFindOne: vi.fn(),
  settingsUpdateOne: vi.fn(),
  userFindOne: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mocks.jwtVerify,
  },
}));

vi.mock("../../src/config/database.js", () => ({
  settingsCollection: {
    findOne: mocks.settingsFindOne,
    updateOne: mocks.settingsUpdateOne,
  },
  usersCollection: {
    findOne: mocks.userFindOne,
  },
}));

import settingsRoutes from "../../src/routes/settingsRoutes.js";

const validPayload = {
  storeName: "RedFlint",
  supportEmail: "support@redflint.com",
  supportPhone: "01700000000",
  whatsappNumber: "01700000000",
  messengerLink: "https://m.me/redflintbd",
  currency: "BDT",
  shippingFee: 120,
  freeShipping: 3000,
  maintenanceMode: false,
  paymentMethods: {
    bkash: {
      enabled: true,
      accountNumber: "TEST-BKASH-ACCOUNT",
      accountType: "Merchant",
      instructions: "Send payment with bKash.",
    },
    nagad: {
      enabled: true,
      accountNumber: "TEST-NAGAD-ACCOUNT",
      accountType: "Merchant",
      instructions: "Send payment with Nagad.",
    },
    cod: {
      enabled: true,
      accountNumber: "",
      accountType: "",
      instructions: "Pay in cash on delivery.",
    },
  },
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/settings", settingsRoutes);

let storedSettings;

describe("Settings Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    storedSettings = {
      _id: "store",
      createdAt: new Date("2026-08-13T10:00:00.000Z"),
      ...validPayload,
      paymentMethods: {
        ...validPayload.paymentMethods,
        bkash: {
          ...validPayload.paymentMethods.bkash,
          enabled: false,
          accountNumber: "",
        },
        nagad: {
          ...validPayload.paymentMethods.nagad,
          enabled: false,
          accountNumber: "",
        },
      },
    };

    mocks.jwtVerify.mockImplementation((token) => {
      if (token === "admin-token") return { email: "admin@example.com" };
      if (token === "customer-token") return { email: "customer@example.com" };
      throw new Error("Invalid token");
    });

    mocks.userFindOne.mockImplementation(async (query, options) => {
      if (options?.projection) return { isBlocked: false };

      return {
        email: query.email,
        role: query.email === "admin@example.com" ? "admin" : "customer",
      };
    });

    mocks.settingsFindOne.mockImplementation(async () => storedSettings);
    mocks.settingsUpdateOne.mockImplementation(async (query, update) => {
      storedSettings = {
        ...storedSettings,
        ...update.$set,
        _id: "store",
        createdAt: storedSettings.createdAt || update.$setOnInsert?.createdAt,
      };

      return { matchedCount: 1, modifiedCount: 1 };
    });
  });

  it("saves and reloads configured bKash and Nagad while preserving COD", async () => {
    const saveResponse = await request(app)
      .patch("/api/settings")
      .set("Cookie", "token=admin-token")
      .send(validPayload);

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.settings.paymentMethods).toEqual({
      bkash: expect.objectContaining({
        enabled: true,
        accountNumber: "TEST-BKASH-ACCOUNT",
        requiresTransactionId: true,
      }),
      nagad: expect.objectContaining({
        enabled: true,
        accountNumber: "TEST-NAGAD-ACCOUNT",
        requiresTransactionId: true,
      }),
      cod: expect.objectContaining({
        enabled: true,
        requiresTransactionId: false,
      }),
    });

    const refreshResponse = await request(app).get("/api/settings");

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.paymentMethods.bkash).toEqual(
      expect.objectContaining({
        enabled: true,
        accountNumber: "TEST-BKASH-ACCOUNT",
      }),
    );
    expect(refreshResponse.body.paymentMethods.nagad).toEqual(
      expect.objectContaining({
        enabled: true,
        accountNumber: "TEST-NAGAD-ACCOUNT",
      }),
    );
    expect(refreshResponse.body.paymentMethods.cod.enabled).toBe(true);
  });

  it.each([
    ["_id", "attacker-controlled"],
    ["createdAt", "2000-01-01T00:00:00.000Z"],
    ["updatedAt", "2000-01-01T00:00:00.000Z"],
  ])("rejects the server-controlled %s field", async (field, value) => {
    const response = await request(app)
      .patch("/api/settings")
      .set("Cookie", "token=admin-token")
      .send({ ...validPayload, [field]: value });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: `Unsupported settings field: ${field}.`,
    });
    expect(mocks.settingsUpdateOne).not.toHaveBeenCalled();
    expect(storedSettings._id).toBe("store");
  });

  it("continues to reject arbitrary settings fields", async () => {
    const response = await request(app)
      .patch("/api/settings")
      .set("Cookie", "token=admin-token")
      .send({ ...validPayload, adminOverride: true });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Unsupported settings field: adminOverride.",
    );
    expect(mocks.settingsUpdateOne).not.toHaveBeenCalled();
  });

  it("rejects a guest attempting to update Store Settings", async () => {
    const response = await request(app)
      .patch("/api/settings")
      .send(validPayload);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized Access");
    expect(mocks.settingsUpdateOne).not.toHaveBeenCalled();
  });

  it("rejects an authenticated customer attempting to update Store Settings", async () => {
    const response = await request(app)
      .patch("/api/settings")
      .set("Cookie", "token=customer-token")
      .send(validPayload);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Forbidden Access");
    expect(mocks.settingsUpdateOne).not.toHaveBeenCalled();
  });
});
