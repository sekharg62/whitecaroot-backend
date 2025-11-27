import { Router, Request, Response } from "express";
import pool from "../db/connection";
import { authMiddleware } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Get company public data (no auth required)
router.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.description,
              ct.logo_url, ct.banner_url, ct.primary_color, ct.secondary_color, ct.video_url
       FROM companies c
       LEFT JOIN company_themes ct ON c.id = ct.company_id
       WHERE c.slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    res.json({ company: result.rows[0] });
  } catch (error) {
    console.error("Get company error:", error);
    res.status(500).json({ error: "Failed to fetch company data" });
  }
});

// Update company info (protected)
router.put(
  "/:slug",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;
      const { name, description } = req.body;

      // Verify ownership
      const ownerCheck = await pool.query(
        "SELECT id FROM companies WHERE slug = $1 AND id = $2",
        [slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res
          .status(403)
          .json({ error: "Not authorized to update this company" });
        return;
      }

      const result = await pool.query(
        `UPDATE companies 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = $3
       RETURNING id, name, slug, description`,
        [name, description, slug]
      );

      res.json({ company: result.rows[0] });
    } catch (error) {
      console.error("Update company error:", error);
      res.status(500).json({ error: "Failed to update company" });
    }
  }
);

// Get company theme (public)
router.get(
  "/:slug/theme",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;

      const result = await pool.query(
        `SELECT ct.*
       FROM company_themes ct
       JOIN companies c ON ct.company_id = c.id
       WHERE c.slug = $1`,
        [slug]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Theme not found" });
        return;
      }

      res.json({ theme: result.rows[0] });
    } catch (error) {
      console.error("Get theme error:", error);
      res.status(500).json({ error: "Failed to fetch theme" });
    }
  }
);

// Update company theme (protected)
router.put(
  "/:slug/theme",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;
      const { primaryColor, secondaryColor, videoUrl, logoUrl, bannerUrl } =
        req.body;

      // Verify ownership
      const ownerCheck = await pool.query(
        "SELECT id FROM companies WHERE slug = $1 AND id = $2",
        [slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized to update this theme" });
        return;
      }

      const result = await pool.query(
        `UPDATE company_themes 
       SET primary_color = COALESCE($1, primary_color),
           secondary_color = COALESCE($2, secondary_color),
           video_url = COALESCE($3, video_url),
           logo_url = COALESCE($4, logo_url),
           banner_url = COALESCE($5, banner_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $6
       RETURNING *`,
        [
          primaryColor,
          secondaryColor,
          videoUrl,
          logoUrl,
          bannerUrl,
          req.user!.companyId,
        ]
      );

      res.json({ theme: result.rows[0] });
    } catch (error) {
      console.error("Update theme error:", error);
      res.status(500).json({ error: "Failed to update theme" });
    }
  }
);

// Upload image (logo or banner) - protected
router.post(
  "/:slug/upload",
  authMiddleware,
  upload.single("image"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;

      // Verify ownership
      const ownerCheck = await pool.query(
        "SELECT id FROM companies WHERE slug = $1 AND id = $2",
        [slug, req.user!.companyId]
      );

      if (ownerCheck.rows.length === 0) {
        res.status(403).json({ error: "Not authorized" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Return the file URL (adjust based on your hosting setup)
      const fileUrl = `/uploads/${req.file.filename}`;

      res.json({
        message: "File uploaded successfully",
        url: fileUrl,
        filename: req.file.filename,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  }
);

export default router;
