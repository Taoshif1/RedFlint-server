import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  jwtVerify: vi.fn(),
  userFindOne: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: mocks.jwtVerify,
  },
}));

vi.mock("../../src/config/database.js", () => ({
  usersCollection: {
    findOne: mocks.userFindOne,
  },
}));

import verifyJWT from "../../src/middleware/verifyJWT.js";
import verifyAdmin from "../../src/middleware/verifyAdmin.js";

const createResponse = () => {
  const res = {};

  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);

  return res;
};

describe("JWT Security Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-AUTH-004
  it("rejects request when authentication token is missing", async () => {
    const req = {
      cookies: {},
    };

    const res = createResponse();
    const next = vi.fn();

    await verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Unauthorized Access",
    });

    expect(next).not.toHaveBeenCalled();
  });

  // TC-BE-AUTH-005
  it("rejects request when JWT token is invalid", async () => {
    const req = {
      cookies: {
        token: "invalid-jwt",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    mocks.jwtVerify.mockImplementation(() => {
      throw new Error("Invalid token");
    });

    await verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Invalid Token",
    });

    expect(next).not.toHaveBeenCalled();
  });

  // TC-BE-AUTH-006
  it("allows authenticated user with valid JWT", async () => {
    const req = {
      cookies: {
        token: "valid-jwt",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    mocks.jwtVerify.mockReturnValue({
      email: "customer@example.com",
      uid: "uid-123",
    });

    mocks.userFindOne.mockResolvedValue({
      isBlocked: false,
    });

    await verifyJWT(req, res, next);

    expect(req.decoded).toEqual({
      email: "customer@example.com",
      uid: "uid-123",
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  // TC-BE-AUTH-007
  it("blocks authenticated user whose account is blocked", async () => {
    const req = {
      cookies: {
        token: "valid-jwt",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    mocks.jwtVerify.mockReturnValue({
      email: "blocked@example.com",
    });

    mocks.userFindOne.mockResolvedValue({
      isBlocked: true,
    });

    await verifyJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "This account is blocked.",
    });

    expect(next).not.toHaveBeenCalled();
  });
});

describe("Admin Security Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-BE-AUTH-008
  it("rejects authenticated user who is not an admin", async () => {
    const req = {
      decoded: {
        email: "customer@example.com",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    mocks.userFindOne.mockResolvedValue({
      email: "customer@example.com",
      role: "customer",
    });

    await verifyAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden Access",
    });

    expect(next).not.toHaveBeenCalled();
  });

  // TC-BE-AUTH-009
  it("allows authenticated admin user", async () => {
    const req = {
      decoded: {
        email: "admin@example.com",
      },
    };

    const res = createResponse();
    const next = vi.fn();

    mocks.userFindOne.mockResolvedValue({
      email: "admin@example.com",
      role: "admin",
    });

    await verifyAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});