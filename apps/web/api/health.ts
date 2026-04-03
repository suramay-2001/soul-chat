import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const checks: Record<string, string> = {};

  checks.runtime = "ok";
  checks.node = process.version;
  checks.OPENAI_API_KEY = process.env.OPENAI_API_KEY ? "set" : "MISSING";
  checks.DATABASE_URL = process.env.DATABASE_URL ? "set" : "MISSING";
  checks.OPENAI_MODEL = process.env.OPENAI_MODEL || "(default gpt-4o)";

  try {
    require("@maa/shared");
    checks.maa_shared = "ok";
  } catch (e: any) {
    checks.maa_shared = `FAIL: ${e.message}`;
  }

  try {
    require("@maa/retrieval");
    checks.maa_retrieval = "ok";
  } catch (e: any) {
    checks.maa_retrieval = `FAIL: ${e.message}`;
  }

  try {
    require("openai");
    checks.openai_sdk = "ok";
  } catch (e: any) {
    checks.openai_sdk = `FAIL: ${e.message}`;
  }

  try {
    require("pg");
    checks.pg = "ok";
  } catch (e: any) {
    checks.pg = `FAIL: ${e.message}`;
  }

  const allOk = !Object.values(checks).some((v) => v.includes("FAIL") || v === "MISSING");

  res.status(allOk ? 200 : 500).json({ status: allOk ? "healthy" : "unhealthy", checks });
}
