import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import Razorpay from "razorpay";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8080);
const KEEP_ALIVE_ENABLED = process.env.KEEP_ALIVE_ENABLED !== "false";
const KEEP_ALIVE_INTERVAL_MINUTES = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES || 10);
const KEEP_ALIVE_TARGET_URL = process.env.KEEP_ALIVE_TARGET_URL;

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in .env");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

app.use(cors({ origin: true }));
app.use(express.json());

app.post("/api/payment/create-order", async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const amountInPaise = Math.round(amount * 100);
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `smartshift_${Date.now()}`,
    });

    return res.json(order);
  } catch {
    return res.status(500).json({ error: "Failed to create payment order" });
  }
});

app.post("/api/payment/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing payment verification fields" });
  }

  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const verified = expectedSignature === razorpay_signature;

  if (!verified) {
    return res.status(400).json({ verified: false, error: "Signature mismatch" });
  }

  return res.json({ verified: true });
});

app.get("/api/payment/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(path.resolve("dist")));

app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }

  return res.sendFile(path.resolve("dist", "index.html"));
});

const startKeepAliveTimer = () => {
  if (!KEEP_ALIVE_ENABLED) return;

  const intervalMs = Math.max(1, KEEP_ALIVE_INTERVAL_MINUTES) * 60 * 1000;
  const targetUrl = KEEP_ALIVE_TARGET_URL || `http://127.0.0.1:${PORT}/api/payment/health`;

  setInterval(async () => {
    try {
      await fetch(targetUrl, { method: "GET" });
      console.log(`[keep-alive] pinged ${targetUrl}`);
    } catch (error) {
      console.error("[keep-alive] ping failed", error instanceof Error ? error.message : String(error));
    }
  }, intervalMs);
};

app.listen(PORT, () => {
  console.log(`SmartShift app running on http://localhost:${PORT}`);
  startKeepAliveTimer();
});
