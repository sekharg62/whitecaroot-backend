import pool from './connection';
import { hashPassword } from '../utils/password';

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seed...');

    await client.query('BEGIN');

    // Create sample companies
    const company1 = await client.query(
      `INSERT INTO companies (name, slug, description) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['TechCorp Solutions', 'techcorp', 'Leading technology solutions provider']
    );

    const company2 = await client.query(
      `INSERT INTO companies (name, slug, description) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['CreativeHub Agency', 'creativehub', 'Award-winning creative design agency']
    );

    // Create users
    const hashedPassword = await hashPassword('password123');

    await client.query(
      `INSERT INTO users (email, password_hash, company_id, full_name) 
       VALUES ($1, $2, $3, $4)`,
      ['recruiter@techcorp.com', hashedPassword, company1.rows[0].id, 'John Doe']
    );

    await client.query(
      `INSERT INTO users (email, password_hash, company_id, full_name) 
       VALUES ($1, $2, $3, $4)`,
      ['recruiter@creativehub.com', hashedPassword, company2.rows[0].id, 'Jane Smith']
    );

    // Create themes
    await client.query(
      `INSERT INTO company_themes (company_id, primary_color, secondary_color) 
       VALUES ($1, $2, $3)`,
      [company1.rows[0].id, '#4F46E5', '#10B981']
    );

    await client.query(
      `INSERT INTO company_themes (company_id, primary_color, secondary_color, video_url) 
       VALUES ($1, $2, $3, $4)`,
      [company2.rows[0].id, '#EC4899', '#F59E0B', 'https://www.youtube.com/embed/dQw4w9WgXcQ']
    );

    // Create sections for TechCorp
    await client.query(
      `INSERT INTO company_sections (company_id, title, content, section_type, order_index) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        company1.rows[0].id,
        'About Us',
        'We are a leading technology solutions provider focused on innovation and excellence. Our team of experts delivers cutting-edge solutions to help businesses thrive in the digital age.',
        'about',
        0
      ]
    );

    await client.query(
      `INSERT INTO company_sections (company_id, title, content, section_type, order_index) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        company1.rows[0].id,
        'Our Culture',
        'We believe in fostering a culture of innovation, collaboration, and continuous learning. Join a team that values your ideas and supports your growth.',
        'culture',
        1
      ]
    );

    // Create jobs for TechCorp
    const jobs = [
      {
        title: 'Senior Frontend Developer',
        description: 'We are looking for an experienced Frontend Developer to join our team. You will work with React, TypeScript, and modern web technologies to build amazing user experiences.',
        workplace: 'Remote',
        location: 'Bangalore, India',
        department: 'Engineering',
        jobType: 'Full time',
        seniority: 'Senior-level',
        salary: '₹20L–30L / year',
        slug: 'senior-frontend-developer'
      },
      {
        title: 'Product Manager',
        description: 'Lead product strategy and execution for our flagship products. Work with cross-functional teams to deliver value to our customers.',
        workplace: 'Hybrid',
        location: 'Mumbai, India',
        department: 'Product',
        jobType: 'Full time',
        seniority: 'Mid-level',
        salary: '₹25L–35L / year',
        slug: 'product-manager'
      },
      {
        title: 'UX Designer',
        description: 'Design beautiful, intuitive user experiences that delight our users. Collaborate with engineers and product managers to bring ideas to life.',
        workplace: 'On-site',
        location: 'Pune, India',
        department: 'Design',
        jobType: 'Full time',
        seniority: 'Mid-level',
        salary: '₹15L–22L / year',
        slug: 'ux-designer'
      },
      {
        title: 'DevOps Engineer',
        description: 'Build and maintain our infrastructure. Work with Kubernetes, AWS, and modern DevOps tools to ensure reliability and scalability.',
        workplace: 'Remote',
        location: 'Anywhere',
        department: 'Engineering',
        jobType: 'Full time',
        seniority: 'Mid-level',
        salary: '₹18L–28L / year',
        slug: 'devops-engineer'
      },
      {
        title: 'Marketing Intern',
        description: 'Join our marketing team and learn about digital marketing, content creation, and brand strategy. Great opportunity for students and recent graduates.',
        workplace: 'On-site',
        location: 'Delhi, India',
        department: 'Marketing',
        jobType: 'Internship',
        seniority: 'Entry-level',
        salary: '₹15K–25K / month',
        slug: 'marketing-intern'
      }
    ];

    for (const job of jobs) {
      await client.query(
        `INSERT INTO jobs (company_id, title, slug, description, workplace, location, department, job_type, seniority, salary, is_published) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          company1.rows[0].id,
          job.title,
          job.slug,
          job.description,
          job.workplace,
          job.location,
          job.department,
          job.jobType,
          job.seniority,
          job.salary,
          true
        ]
      );
    }

    await client.query('COMMIT');

    console.log('✅ Database seeded successfully!');
    console.log('\n📝 Sample credentials:');
    console.log('   Email: recruiter@techcorp.com');
    console.log('   Password: password123');
    console.log('   Company: techcorp\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

