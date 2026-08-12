import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  settingsCollection: {
    findOne: mocks.findOne,
    insertOne: mocks.insertOne,
    updateOne: mocks.updateOne,
  },
}));

import { getSettings } from "../../src/controllers/settingsController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("Settings Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-SETTINGS-001
  it("creates default store settings when settings do not exist", async () => {
    mocks.findOne.mockResolvedValue(null);

    mocks.insertOne.mockResolvedValue({
      acknowledged: true,
    });

    const req = {};
    const res = createResponse();

    await getSettings(req, res);

    expect(mocks.findOne).toHaveBeenCalledWith({
      _id: "store",
    });

    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "store",
        storeName: "RedFlint",
        currency: "BDT",
        shippingFee: 120,
        freeShipping: 3000,
        maintenanceMode: false,
        createdAt: expect.any(Date),
      }),
    );

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "store",
        storeName: "RedFlint",
        shippingFee: 120,
        freeShipping: 3000,
        maintenanceMode: false,
      }),
    );
  });
});