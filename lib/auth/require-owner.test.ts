import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { requireOwner } from "./require-owner";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const mockAuth = vi.mocked(auth);

describe("requireOwner", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    vi.stubEnv("OWNER_EMAIL", "owner@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing session", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(requireOwner()).rejects.toThrow("Unauthorized");
  });

  it("rejects a session for a different email", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "someone-else@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(requireOwner()).rejects.toThrow("Unauthorized");
  });

  it("accepts the owner email case-insensitively", async () => {
    vi.stubEnv("OWNER_EMAIL", " Owner@Example.com ");
    mockAuth.mockResolvedValue({
      user: { email: "OWNER@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    });

    await expect(requireOwner()).resolves.toBeUndefined();
  });
});
