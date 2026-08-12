import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyFirebaseIdToken: vi.fn(),
  generateToken: vi.fn(),
}));

vi.mock("../../src/utils/verifyFirebaseIdToken.js", () => ({
  default: mocks.verifyFirebaseIdToken,
}));

vi.mock("../../src/utils/generateToken.js", () => ({
  default: mocks.generateToken,
}));

import {
  createJWT,
  logout,
} from "../../src/controllers/authController.js";

const createResponse = () => {
  const res = {};

  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("Auth Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-AUTH-001
  it("creates JWT session after valid Firebase authentication", async () => {
    const req = {
      body: {
        idToken: "valid-firebase-token",
      },
    };

    const res = createResponse();

    mocks.verifyFirebaseIdToken.mockResolvedValue({
      email: "customer@example.com",
      uid: "firebase-uid-123",
    });

    mocks.generateToken.mockReturnValue("generated-jwt-token");

    await createJWT(req, res);

    expect(mocks.verifyFirebaseIdToken).toHaveBeenCalledWith(
      "valid-firebase-token",
    );

    expect(mocks.generateToken).toHaveBeenCalledWith({
      email: "customer@example.com",
      uid: "firebase-uid-123",
    });

    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      "generated-jwt-token",
      expect.objectContaining({
        httpOnly: true,
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Authenticated session created successfully.",
      user: {
        email: "customer@example.com",
        uid: "firebase-uid-123",
      },
    });
  });

  // TC-BE-AUTH-002
  it("rejects authentication when Firebase token verification fails", async () => {
    const req = {
      body: {
        idToken: "invalid-token",
      },
    };

    const res = createResponse();

    mocks.verifyFirebaseIdToken.mockRejectedValue(
      new Error("Invalid Firebase token"),
    );

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await createJWT(req, res);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Unable to verify Firebase authentication.",
    });

    consoleSpy.mockRestore();
  });

  // TC-BE-AUTH-003
  it("clears authentication cookie during logout", () => {
    const req = {};
    const res = createResponse();

    logout(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({
        httpOnly: true,
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Logged Out Successfully",
    });
  });
});