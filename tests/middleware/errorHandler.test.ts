import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import { errorHandler, AppError } from "../../src/middleware/errorHandler";

const makeRes = () => {
  const res: Partial<Response> & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  } = {
    status: vi.fn().mockReturnThis() as any,
    json: vi.fn().mockReturnThis() as any,
  };
  return res;
};

describe("errorHandler", () => {
  it("maps AppError to its statusCode and message", () => {
    const res = makeRes();
    errorHandler(
      new AppError("Forbidden", 403),
      {} as Request,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Forbidden" })
    );
  });

  it("maps a plain Error to 500", () => {
    const res = makeRes();
    errorHandler(
      new Error("boom"),
      {} as Request,
      res as unknown as Response,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "boom" })
    );
  });

  it("includes stack in development and hides it in production", () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      const devRes = makeRes();
      errorHandler(new Error("e1"), {} as Request, devRes as unknown as Response, vi.fn());
      expect(devRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ stack: expect.any(String) })
      );

      process.env.NODE_ENV = "production";
      const prodRes = makeRes();
      errorHandler(new Error("e2"), {} as Request, prodRes as unknown as Response, vi.fn());
      const payload = prodRes.json.mock.calls[0][0];
      expect(payload).not.toHaveProperty("stack");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
