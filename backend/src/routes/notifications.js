/**
 * /api/notifications — In-platform notification inbox
 *
 * GET  /                 → list notifications for current user (latest 50)
 * POST /read-all         → mark all as read
 * POST /:id/read         → mark one as read
 */

import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// GET /api/notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const unread_count = (data ?? []).filter((n) => !n.read).length;

    return res.json({
      success: true,
      notifications: data ?? [],
      unread_count,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/:id/read
router.post("/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.operator.sub || req.operator.id;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", req.params.id)
      .eq("user_id", userId);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
