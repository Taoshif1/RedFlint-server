import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("../../src/config/database.js", () => ({
  usersCollection: {
    findOne: mocks.findOne,
    insertOne: mocks.insertOne,
    updateOne: mocks.updateOne,
  },
}));

import {
  createUser,
  getUserByEmail,
} from "../../src/controllers/userController.js";

import { addAddress } from "../../src/controllers/addressController.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("User and Address Controllers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-USER-001
  it("creates a new customer profile using authenticated identity", async () => {
    const insertedId = "user-id-1";

    mocks.findOne.mockResolvedValue(null);
    mocks.insertOne.mockResolvedValue({
      insertedId,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
        uid: "firebase-uid-1",
      },

      body: {
        name: "  Customer Name  ",
        phone: " 01700000000 ",
        photoURL: "photo.jpg",
      },
    };

    const res = createResponse();

    await createUser(req, res);

    expect(mocks.findOne).toHaveBeenCalledWith({
      email: "customer@example.com",
    });

    expect(mocks.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "firebase-uid-1",
        email: "customer@example.com",
        name: "Customer Name",
        phone: "01700000000",
        photoURL: "photo.jpg",
        role: "customer",
        isBlocked: false,
        addresses: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLogin: expect.any(Date),
      }),
    );

    expect(res.status).toHaveBeenCalledWith(201);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "User created successfully.",
      insertedId,
    });
  });

  // TC-BE-USER-002
  it("forbids a user from reading another user's profile", async () => {
    const req = {
      decoded: {
        email: "customer@example.com",
      },

      params: {
        email: "other@example.com",
      },
    };

    const res = createResponse();

    await getUserByEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden",
    });

    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  // TC-BE-USER-003
  it("makes the first saved address the default address", async () => {
    mocks.findOne.mockResolvedValue({
      email: "customer@example.com",
      addresses: [],
    });

    mocks.updateOne.mockResolvedValue({
      modifiedCount: 1,
    });

    const req = {
      decoded: {
        email: "customer@example.com",
      },

      params: {
        email: "customer@example.com",
      },

      body: {
        label: " Home ",
        receiver: " Customer Name ",
        phone: " 01700000000 ",
        address: " Dhanmondi ",
        city: " Dhaka ",
        postalCode: " 1209 ",
        isDefault: false,
      },
    };

    const res = createResponse();

    await addAddress(req, res);

    expect(mocks.updateOne).toHaveBeenCalledTimes(1);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        email: "customer@example.com",
      },
      {
        $push: {
          addresses: expect.objectContaining({
            _id: expect.any(String),
            label: "Home",
            receiver: "Customer Name",
            phone: "01700000000",
            address: "Dhanmondi",
            city: "Dhaka",
            postalCode: "1209",
            isDefault: true,
            createdAt: expect.any(Date),
          }),
        },

        $set: {
          updatedAt: expect.any(Date),
        },
      },
    );

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Address added successfully.",

        address: expect.objectContaining({
          isDefault: true,
        }),
      }),
    );
  });
});