import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted axios mock — vi.mock calls are lifted to the top of the file,
// so the email module will pick up this mock when it imports axios.
vi.mock("axios", () => ({
  default: { post: vi.fn() },
}));

import axios from "axios";

describe("emailService.sendEmail", () => {
  const originalKey = process.env.MAILEROO_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.MAILEROO_API_KEY;
    } else {
      process.env.MAILEROO_API_KEY = originalKey;
    }
  });

  it("does NOT call the Maileroo API when MAILEROO_API_KEY is empty", async () => {
    process.env.MAILEROO_API_KEY = "";
    const { emailService } = await import("../../src/utils/email");

    await emailService.sendEmail({
      to: "foo@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    });

    expect((axios as unknown as { post: ReturnType<typeof vi.fn> }).post).not
      .toHaveBeenCalled();
  });

  it("calls the Maileroo API with the configured key when it IS set", async () => {
    process.env.MAILEROO_API_KEY = "test-key";
    (axios as unknown as { post: ReturnType<typeof vi.fn> }).post.mockResolvedValue({
      data: { id: "abc" },
    });

    const { emailService } = await import("../../src/utils/email");

    await emailService.sendEmail({
      to: "foo@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
    });

    const post = (axios as unknown as { post: ReturnType<typeof vi.fn> }).post;
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toMatch(/maileroo/);
    expect(body.subject).toBe("Hi");
    expect(config.headers["X-API-Key"]).toBe("test-key");
  });
});
