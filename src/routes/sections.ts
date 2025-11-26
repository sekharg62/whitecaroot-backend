import { Router, Request, Response } from "express";
import pool from "../db/connection";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Get all sections for a company (public)
router.get(
  "/:slug/sections",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;

      const result = await pool.query(
        `SELECT s.*
       FROM company_sections s
       JOIN companies c ON s.company_id = c.id
       WHERE c.slug = $1
       ORDER BY s.order_index ASC`,
        [slug]
      );

      res.json({ sections: result.rows });
    } catch (error) {
      console.error("Get sections error:", error);
      res.status(500).json({ error: "Failed to fetch sections" });
    }
  }
);

// Create new section (protected)
router.post(
  "/:slug/sections",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;
      const { title, content, sectionType, isVisible } = req.body;

      if (!title || !content) {
        res.status(400).json({ error: "Title and content are required" });
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

      // Get max order_index
      const maxOrderResult = await pool.query(
        "SELECT COALESCE(MAX(order_index), -1) as max_order FROM company_sections WHERE company_id = $1",
        [req.user!.companyId]
      );

      const newOrder = maxOrderResult.rows[0].max_order + 1;

      // Insert section
      const result = await pool.query(
        `INSERT INTO company_sections (company_id, title, content, section_type, order_index, is_visible)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
        [
          req.user!.companyId,
          title,
          content,
          sectionType || "custom",
          newOrder,
          isVisible ?? true,
        ]
      );

      res.status(201).json({ section: result.rows[0] });
    } catch (error) {
      console.error("Create section error:", error);
      res.status(500).json({ error: "Failed to create section" });
    }
  }
);
// Reorder sections (protected)
router.put(
  "/:slug/sections/reorder",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
      const { slug } = req.params;
      const { sectionIds } = req.body; // Array of section IDs in new order

      if (!Array.isArray(sectionIds)) {
        res.status(400).json({ error: "sectionIds must be an array" });
        return;
      }

      // Verify ownership
      const ownerCheck = await client.query(
        "SELECT id FROM companies WHERE slug = $1 AND id = $2",
        [slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      await client.query("BEGIN");

      // Update order_index for each section
      for (let i = 0; i < sectionIds.length; i++) {
        await client.query(
          `UPDATE company_sections 
         SET order_index = $1 
         WHERE id = $2 AND company_id = $3`,
          [i, sectionIds[i], req.user!.companyId]
        );
      }

      await client.query("COMMIT");

      res.json({ message: "Sections reordered successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Reorder sections error:", error);
      res.status(500).json({ error: "Failed to reorder sections" });
    } finally {
      client.release();
    }
  }
);
// Update section (protected)
router.put(
  "/:slug/sections/:id",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug, id } = req.params;
      const { title, content, sectionType, isVisible } = req.body;

      // Verify ownership
      const ownerCheck = await pool.query(
        `SELECT s.id FROM company_sections s
       JOIN companies c ON s.company_id = c.id
       WHERE s.id = $1 AND c.slug = $2 AND c.id = $3`,
        [id, slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      const result = await pool.query(
        `UPDATE company_sections
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           section_type = COALESCE($3, section_type),
           is_visible = COALESCE($4, is_visible),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
        [title, content, sectionType, isVisible, id]
      );

      res.json({ section: result.rows[0] });
    } catch (error) {
      console.error("Update section error:", error);
      res.status(500).json({ error: "Failed to update section" });
    }
  }
);

// Delete section (protected)
router.delete(
  "/:slug/sections/:id",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug, id } = req.params;

      // Verify ownership
      const ownerCheck = await pool.query(
        `SELECT s.id FROM company_sections s
       JOIN companies c ON s.company_id = c.id
       WHERE s.id = $1 AND c.slug = $2 AND c.id = $3`,
        [id, slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      await pool.query("DELETE FROM company_sections WHERE id = $1", [id]);

      res.json({ message: "Section deleted successfully" });
    } catch (error) {
      console.error("Delete section error:", error);
      res.status(500).json({ error: "Failed to delete section" });
    }
  }
);

export default router;
