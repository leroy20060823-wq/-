import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createRateLimiter } from "./rateLimit.js";

interface FakeRes {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader(k: string, v: string): void;
  status(c: number): FakeRes;
  json(b: unknown): FakeRes;
}

function fakeRes(): FakeRes {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

test("rate limiter blocks after max within the window", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: "too many" });
  const req = { ip: "1.2.3.4" } as Request;
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  limiter(req, fakeRes() as unknown as Response, next);
  limiter(req, fakeRes() as unknown as Response, next);
  const blocked = fakeRes();
  limiter(req, blocked as unknown as Response, next);

  assert.equal(nextCalls, 2);
  assert.equal(blocked.statusCode, 429);
  assert.deepEqual(blocked.body, { error: "too many" });
  assert.ok(blocked.headers["Retry-After"]);
});

test("rate limiter counts each IP independently", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, message: "x" });
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };
  limiter({ ip: "a" } as Request, fakeRes() as unknown as Response, next);
  limiter({ ip: "b" } as Request, fakeRes() as unknown as Response, next);
  assert.equal(nextCalls, 2);
});
