import { Router, Request, Response } from "express";
import pool from "../db/connection";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { slugify } from "../utils/slugify";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Register new recruiter and company
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    const { email, password, companyName, fullName } = req.body;

    // Validation
    if (!email || !password || !companyName) {
      res
        .status(400)
        .json({ error: "Email, password, and company name are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    await client.query("BEGIN");

    // Check if email already exists
    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    // Generate unique company slug
    let companySlug = slugify(companyName);
    const existingSlug = await client.query(
      "SELECT id FROM companies WHERE slug = $1",
      [companySlug]
    );

    if (existingSlug.rows.length > 0) {
      companySlug = `${companySlug}-${Date.now()}`;
    }

    // Create company
    const companyResult = await client.query(
      "INSERT INTO companies (name, slug) VALUES ($1, $2) RETURNING id, name, slug",
      [companyName, companySlug]
    );

    const company = companyResult.rows[0];

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await client.query(
      "INSERT INTO users (email, password_hash, company_id, full_name) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name",
      [email, passwordHash, company.id, fullName || null]
    );

    const user = userResult.rows[0];

    // Create default theme for company
    await client.query("INSERT INTO company_themes (company_id) VALUES ($1)", [
      company.id,
    ]);

    await client.query("COMMIT");

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      companyId: company.id,
      email: user.email,
    });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  } finally {
    client.release();
  }
});

// Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    // Find user with company info
    const result = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, 
              c.name as company_name, c.slug as company_slug
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);

    if (!isValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      companyId: user.company_id,
      email: user.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
      },
      company: {
        id: user.company_id,
        name: user.company_name,
        slug: user.company_slug,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user info (protected route)
router.get(
  "/me",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT u.id, u.email, u.full_name, u.company_id,
              c.name as company_name, c.slug as company_slug
       FROM users u
       JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
        [req.user!.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = result.rows[0];

      res.json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
        },
        company: {
          id: user.company_id,
          name: user.company_name,
          slug: user.company_slug,
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  }
);

export default router;
