import { Router } from "express";
import multer from "multer";
import { authRequired, requireRoles } from "../middleware/auth.js";
import {
  listPolls,
  getPollDetails,
  createPoll,
  updatePoll,
  changePollStatus,
  submitBallot,
  calculatePollResults,
} from "../services/menuPoll.service.js";
import {
  addCandidate,
  updateCandidate,
  reviewCandidateProposal,
  generateCandidateCsvTemplate,
  parseAndValidateCandidateCsv,
  commitCandidateCsvImport,
} from "../services/candidate.service.js";
import { prisma } from "../lib/prisma.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

/**
 * List polls accessible to user
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    const { status, messType } = req.query;
    const polls = await listPolls({
      role: req.userRole,
      userId: req.userId,
      status,
      messType,
    });
    res.json(polls);
  } catch (e) {
    next(e);
  }
});

/**
 * Get detailed poll with categories, candidates, and ballot state
 */
router.get("/:id", authRequired, async (req, res, next) => {
  try {
    const poll = await getPollDetails(req.params.id, {
      role: req.userRole,
      userId: req.userId,
    });
    if (!poll) return res.status(404).json({ error: "Poll not found" });
    res.json(poll);
  } catch (e) {
    next(e);
  }
});

/**
 * Create a new poll (Admin)
 */
router.post("/", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const poll = await createPoll(req.body, req.userId);
    res.status(201).json(poll);
  } catch (e) {
    next(e);
  }
});

/**
 * Update poll configuration (Admin)
 */
router.patch("/:id", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const updated = await updatePoll(req.params.id, req.body, req.userId);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * Change poll lifecycle status (Admin)
 */
router.post("/:id/status", authRequired, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const updated = await changePollStatus(req.params.id, status, req.userId, reason);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/**
 * Submit or edit ballot for a specific category (Student)
 */
router.put(
  "/:id/ballots/:categoryId",
  authRequired,
  requireRoles("STUDENT"),
  async (req, res, next) => {
    try {
      const { candidateIds } = req.body;
      if (!Array.isArray(candidateIds)) {
        return res.status(400).json({ error: "candidateIds array required" });
      }
      const result = await submitBallot(
        req.params.id,
        req.params.categoryId,
        candidateIds,
        req.userId
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Get student's current ballot across all categories
 */
router.get("/:id/ballot", authRequired, requireRoles("STUDENT"), async (req, res, next) => {
  try {
    const ballots = await prisma.menuPollBallot.findMany({
      where: { pollId: req.params.id, userId: req.userId },
      include: {
        category: true,
        selections: {
          include: {
            candidate: {
              include: { menuItem: true },
            },
          },
        },
      },
    });
    res.json(ballots);
  } catch (e) {
    next(e);
  }
});

/**
 * Get poll results & analytics
 */
router.get("/:id/results", authRequired, async (req, res, next) => {
  try {
    const results = await calculatePollResults(req.params.id);
    res.json(results);
  } catch (e) {
    next(e);
  }
});

/**
 * Add a candidate dish (Admin / Mess Manager)
 */
router.post(
  "/:id/candidates",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const candidate = await addCandidate(
        req.params.id,
        req.body,
        { id: req.userId, role: req.userRole }
      );
      res.status(201).json(candidate);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Update candidate / toggle availability (Admin / Mess Manager)
 */
router.patch(
  "/:id/candidates/:candidateId",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const updated = await updateCandidate(
        req.params.candidateId,
        req.body,
        { id: req.userId, role: req.userRole }
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Approve or reject candidate proposal (Admin)
 */
router.post(
  "/:id/candidates/:candidateId/review",
  authRequired,
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const { status, rejectionReason } = req.body;
      const updated = await reviewCandidateProposal(
        req.params.candidateId,
        { status, rejectionReason },
        req.userId
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Download candidate CSV template
 */
router.get("/:id/candidates/template", authRequired, (req, res) => {
  const csvContent = generateCandidateCsvTemplate();
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="candidates_template_poll_${req.params.id.slice(0, 8)}.csv"`
  );
  res.send(csvContent);
});

/**
 * Preview candidate CSV before import (Admin / Mess Manager)
 */
router.post(
  "/:id/candidates/preview",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "file field required" });
      }
      const preview = await parseAndValidateCandidateCsv(
        req.file.buffer,
        req.params.id,
        { id: req.userId, role: req.userRole }
      );
      res.json(preview);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Commit candidate CSV import (Admin / Mess Manager)
 */
router.post(
  "/:id/candidates/import",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "rows array required for import" });
      }
      const result = await commitCandidateCsvImport(
        req.params.id,
        rows,
        { id: req.userId, role: req.userRole }
      );
      res.json(result);
    } catch (e) {
      next(e);
    }
  }
);

/**
 * Get audit logs for this poll (Admin / Mess Manager)
 */
router.get(
  "/:id/audits",
  authRequired,
  requireRoles("MESS_INCHARGE", "ADMIN"),
  async (req, res, next) => {
    try {
      const audits = await prisma.menuPollAudit.findMany({
        where: { pollId: req.params.id },
        include: {
          actor: { select: { id: true, name: true, role: true, email: true } },
          candidate: { select: { id: true, dishName: true, messType: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(audits);
    } catch (e) {
      next(e);
    }
  }
);

export default router;
