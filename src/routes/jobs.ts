import { Router, Request, Response } from "express";
import pool from "../db/connection";
import { authMiddleware } from "../middleware/auth";
import { slugify } from "../utils/slugify";

const router = Router();

// Get all published jobs for a company with filters (public)
router.get(
  "/:slug/jobs",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;
      const { search, location, jobType, department } = req.query;

      let query = `
      SELECT j.*
      FROM jobs j
      JOIN companies c ON j.company_id = c.id
      WHERE c.slug = $1 AND j.is_published = true
    `;

      const params: any[] = [slug];
      let paramCount = 1;

      // Add search filter
      if (search && typeof search === "string") {
        paramCount++;
        query += ` AND (j.title ILIKE $${paramCount} OR j.description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Add location filter
      if (location && typeof location === "string") {
        paramCount++;
        query += ` AND j.location ILIKE $${paramCount}`;
        params.push(`%${location}%`);
      }

      // Add job type filter
      if (jobType && typeof jobType === "string") {
        paramCount++;
        query += ` AND j.job_type = $${paramCount}`;
        params.push(jobType);
      }

      // Add department filter
      if (department && typeof department === "string") {
        paramCount++;
        query += ` AND j.department = $${paramCount}`;
        params.push(department);
      }

      query += " ORDER BY j.created_at DESC";

      const result = await pool.query(query, params);

      res.json({ jobs: result.rows });
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  }
);


// Get all jobs for company (including unpublished) - protected
router.get(
  "/:slug/jobs/all",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    console.log("called")
    try {
      const { slug } = req.params;
      console.log("slug", slug);

      // Verify ownership
      const ownerCheck = await pool.query(
        "SELECT id FROM companies WHERE slug = $1 AND id = $2",
        [slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const result = await pool.query(
        `SELECT * FROM jobs WHERE company_id = $1 ORDER BY created_at DESC`,
        [req.user!.companyId]
      );

      res.json({ jobs: result.rows });
    } catch (error) {
      console.error("Get all jobs error:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  }
);

// Get single job by slug (public)
router.get(
  "/:slug/jobs/:jobSlug",
  async (req: Request, res: Response): Promise<void> => {
    
    try {
      const { slug, jobSlug } = req.params;

      const result = await pool.query(
        `SELECT j.*, c.name as company_name, c.slug as company_slug
       FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE c.slug = $1 AND j.slug = $2 AND j.is_published = true`,
        [slug, jobSlug]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Job not founddddd" });
        console.log("calling::")
        return;
      }

      res.json({ job: result.rows[0] });
    } catch (error) {
      console.error("Get job error:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  }
);
// Create new job (protected)
router.post(
  "/:slug/jobs",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;
      const {
        title,
        description,
        workplace,
        location,
        department,
        jobType,
        seniority,
        salary,
        isPublished,
      } = req.body;

      if (!title || !description) {
        res.status(400).json({ error: "Title and description are required" });
        return;
      }

      // Verify ownership
      const ownerCheck = await pool.query(
        "SELECT id FROM companies WHERE slug = $1 AND id = $2",
        [slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      // Generate unique slug for job
      let jobSlug = slugify(title);
      const existingSlug = await pool.query(
        "SELECT id FROM jobs WHERE company_id = $1 AND slug = $2",
        [req.user!.companyId, jobSlug]
      );

      if (existingSlug.rows.length > 0) {
        jobSlug = `${jobSlug}-${Date.now()}`;
      }

      const result = await pool.query(
        `INSERT INTO jobs (
        company_id, title, slug, description, workplace, location, 
        department, job_type, seniority, salary, is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
        [
          req.user!.companyId,
          title,
          jobSlug,
          description,
          workplace,
          location,
          department,
          jobType,
          seniority,
          salary,
          isPublished ?? false,
        ]
      );

      res.status(201).json({ job: result.rows[0] });
    } catch (error) {
      console.error("Create job error:", error);
      res.status(500).json({ error: "Failed to create job" });
    }
  }
);

// Update job (protected)
router.put(
  "/:slug/jobs/:id",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug, id } = req.params;
      const {
        title,
        description,
        workplace,
        location,
        department,
        jobType,
        seniority,
        salary,
        isPublished,
      } = req.body;

      // Verify ownership
      const ownerCheck = await pool.query(
        `SELECT j.id FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE j.id = $1 AND c.slug = $2 AND c.id = $3`,
        [id, slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const result = await pool.query(
        `UPDATE jobs
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           workplace = COALESCE($3, workplace),
           location = COALESCE($4, location),
           department = COALESCE($5, department),
           job_type = COALESCE($6, job_type),
           seniority = COALESCE($7, seniority),
           salary = COALESCE($8, salary),
           is_published = COALESCE($9, is_published),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
        [
          title,
          description,
          workplace,
          location,
          department,
          jobType,
          seniority,
          salary,
          isPublished,
          id,
        ]
      );

      res.json({ job: result.rows[0] });
    } catch (error) {
      console.error("Update job error:", error);
      res.status(500).json({ error: "Failed to update job" });
    }
  }
);

// Delete job (protected)
router.delete(
  "/:slug/jobs/:id",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug, id } = req.params;

      // Verify ownership
      const ownerCheck = await pool.query(
        `SELECT j.id FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE j.id = $1 AND c.slug = $2 AND c.id = $3`,
        [id, slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      await pool.query("DELETE FROM jobs WHERE id = $1", [id]);

      res.json({ message: "Job deleted successfully" });
    } catch (error) {
      console.error("Delete job error:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  }
);

// Toggle job publish status (protected)
router.patch(
  "/:slug/jobs/:id/publish",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug, id } = req.params;
      const { isPublished } = req.body;

      // Verify ownership
      const ownerCheck = await pool.query(
        `SELECT j.id FROM jobs j
       JOIN companies c ON j.company_id = c.id
       WHERE j.id = $1 AND c.slug = $2 AND c.id = $3`,
        [id, slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const result = await pool.query(
        `UPDATE jobs
       SET is_published = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
        [isPublished, id]
      );

      res.json({ job: result.rows[0] });
    } catch (error) {
      console.error("Toggle publish error:", error);
      res.status(500).json({ error: "Failed to update job status" });
    }
  }
);

export default router;
