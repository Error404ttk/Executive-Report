import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fileUpload from 'express-fileupload';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import helmet from 'helmet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === 'production';
const projectRoot = isProduction ? process.cwd() : __dirname;
const runtimeUploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(projectRoot, 'public', 'uploads'));
const tempDir = path.resolve(process.env.TMP_DIR || '/tmp');
const VALID_CATEGORIES = new Set(['agency', 'department', 'meeting', 'audit', 'cyber']);
const VALID_ROLES = new Set(['admin', 'executive', 'user']);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);
const SESSION_SECRET = process.env.SESSION_SECRET || (isProduction ? '' : crypto.randomBytes(32).toString('hex'));
const REPORT_ANALYSIS_PROMPT = `วิเคราะห์รายงาน PDF นี้เป็นภาษาไทย และตอบกลับเป็น JSON เท่านั้น

ข้อกำหนดสำหรับ summary:
- สรุปเป็นข้อ ๆ แบบ bullet list จำนวน 3-6 ข้อ
- แต่ละข้อสั้น กระชับ พอได้ใจความ ไม่เกิน 1-2 บรรทัด
- เน้นประเด็นที่ผู้บริหารต้องรู้: เรื่องสำคัญ ผลกระทบ ความเสี่ยง ตัวเลขสำคัญ หรือสิ่งที่ต้องติดตาม
- ไม่ต้องเขียนเกริ่นนำ ไม่ต้องสรุปยาวเป็นย่อหน้า

เลือก category ที่เหมาะสมที่สุดจาก: "agency" (ระดับหน่วยงาน), "department" (ฝ่าย), "meeting" (การประชุม), "audit" (ตรวจสอบภายใน), "cyber" (ไซเบอร์)
ดึง fullText เป็นข้อความต้นฉบับทั้งหมดจากรายงานเพื่อใช้ค้นหา

ตอบกลับเป็น JSON รูปแบบนี้เท่านั้น:
{
  "summary": "- ประเด็นสำคัญข้อที่ 1\\n- ประเด็นสำคัญข้อที่ 2\\n- ประเด็นสำคัญข้อที่ 3",
  "category": "agency|department|meeting|audit|cyber",
  "fullText": "ข้อความทั้งหมดในไฟล์..."
}`;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

// Validate required environment variables at startup
const REQUIRED_ENV = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'GEMINI_API_KEY'];
for (const key of REQUIRED_ENV) {
  requireEnv(key);
}

if (isProduction) {
  for (const key of ['SESSION_SECRET', 'DEFAULT_ADMIN_EMAIL', 'DEFAULT_ADMIN_PASSWORD', 'DEFAULT_EXEC_EMAIL', 'DEFAULT_EXEC_PASSWORD', 'DEFAULT_USER_EMAIL', 'DEFAULT_USER_PASSWORD']) {
    requireEnv(key);
  }
}

function isValidCategory(value: unknown): value is string {
  return typeof value === 'string' && VALID_CATEGORIES.has(value);
}

function isValidRole(value: unknown): value is string {
  return typeof value === 'string' && VALID_ROLES.has(value);
}

function getUser(req: express.Request) {
  return (req as any).user as { id: string; email: string; role: string; displayName: string };
}

function resolveUploadFile(fileUrl: string): string | null {
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith('/uploads/')) return null;
  const fileName = path.basename(fileUrl);
  const resolved = path.resolve(runtimeUploadDir, fileName);
  return resolved.startsWith(runtimeUploadDir + path.sep) ? resolved : null;
}

function unlinkIfExists(filePath: string) {
  fs.promises.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') {
      console.warn(`Could not delete file ${filePath}:`, error.message);
    }
  });
}

function normalizeBulletSummary(input: string): string {
  const text = String(input || '').trim();
  if (!text) return '';

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);

  const points = lines.length > 1
    ? lines
    : text
        .split(/(?<=[.!?。！？])\s+|(?<=\u0e2f)\s+|(?<=\u0e30)\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

  return points
    .slice(0, 6)
    .map((point) => `- ${point.length > 220 ? `${point.slice(0, 217)}...` : point}`)
    .join('\n');
}

type SessionPayload = {
  id: string;
  email: string;
  role: string;
  displayName: string;
  sessionVersion: number;
  exp: number;
};

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function signSession(payload: Omit<SessionPayload, 'exp'>): string {
  const sessionPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + Number(process.env.SESSION_TTL_SECONDS || 8 * 60 * 60),
  };
  const body = base64Url(JSON.stringify(sessionPayload));
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifySession(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
  } catch {
    return null;
  }
  if (!payload.id || !payload.email || !payload.role || !payload.displayName || typeof payload.sessionVersion !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// Database pool setup
const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!, 10),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedValue: string): boolean {
  if (!storedValue.includes(':')) {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    return legacyHash === storedValue;
  }
  const [salt, originalHash] = storedValue.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

async function addColumnIfMissing(tableName: string, columnName: string, definition: string) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  if ((rows as any[]).length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

async function addIndexIfMissing(tableName: string, indexName: string, definition: string) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );
  if ((rows as any[]).length === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
  }
}

async function runMigrations() {
  await addColumnIfMissing('users', 'sessionVersion', 'INT NOT NULL DEFAULT 1');
  await addColumnIfMissing('users', 'isActive', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing('analysis_jobs', 'sourceFileUrl', 'VARCHAR(500)');
  await addColumnIfMissing('analysis_jobs', 'reportId', 'VARCHAR(255)');
  await addColumnIfMissing('analysis_jobs', 'fallbackCategory', 'VARCHAR(50)');
  await addColumnIfMissing('analysis_jobs', 'updatedAt', 'VARCHAR(255)');
  await addColumnIfMissing('analysis_jobs', 'lockedAt', 'VARCHAR(255)');
  await addColumnIfMissing('analysis_jobs', 'attempts', 'INT NOT NULL DEFAULT 0');

  await addIndexIfMissing('reports', 'idx_reports_category_uploaded_at', 'INDEX `idx_reports_category_uploaded_at` (`category`, `uploadedAt`)');
  await addIndexIfMissing('reports', 'idx_reports_job_id', 'INDEX `idx_reports_job_id` (`jobId`)');
  await addIndexIfMissing('comments', 'idx_comments_report_created', 'INDEX `idx_comments_report_created` (`reportId`, `createdAt`)');
  await addIndexIfMissing('views', 'idx_views_report', 'INDEX `idx_views_report` (`reportId`)');
  await addIndexIfMissing('audit_logs', 'idx_audit_logs_timestamp', 'INDEX `idx_audit_logs_timestamp` (`timestamp`)');
  await addIndexIfMissing('analysis_jobs', 'idx_analysis_jobs_status_updated', 'INDEX `idx_analysis_jobs_status_updated` (`status`, `updatedAt`)');
  await pool.query(`
    DELETE a FROM acknowledgments a
    INNER JOIN acknowledgments b
      ON a.reportId = b.reportId
      AND a.userId = b.userId
      AND a.id > b.id
  `);
  await addIndexIfMissing('acknowledgments', 'uniq_ack_report_user', 'UNIQUE INDEX `uniq_ack_report_user` (`reportId`, `userId`)');
}

async function initDatabase() {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@moph.go.th';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'change-this-admin-password';
  const execEmail = process.env.DEFAULT_EXEC_EMAIL || 'exec@moph.go.th';
  const execPassword = process.env.DEFAULT_EXEC_PASSWORD || 'change-this-exec-password';
  const userEmail = process.env.DEFAULT_USER_EMAIL || 'user@moph.go.th';
  const userPassword = process.env.DEFAULT_USER_PASSWORD || 'change-this-user-password';

  // Create tables in order
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agencies (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      createdAt VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      displayName VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      agencyId VARCHAR(255),
      avatarUrl VARCHAR(255),
      passwordHash VARCHAR(255) NOT NULL,
      sessionVersion INT NOT NULL DEFAULT 1,
      isActive TINYINT(1) NOT NULL DEFAULT 1,
      FOREIGN KEY (agencyId) REFERENCES agencies(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(50) NOT NULL,
      agencyId VARCHAR(255) NOT NULL,
      fileUrl VARCHAR(500) NOT NULL,
      summary TEXT,
      \`fullText\` MEDIUMTEXT,
      uploadedBy VARCHAR(255) NOT NULL,
      uploadedAt VARCHAR(255) NOT NULL,
      status VARCHAR(50),
      jobId VARCHAR(255),
      FOREIGN KEY (agencyId) REFERENCES agencies(id) ON DELETE CASCADE,
      FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS acknowledgments (
      id VARCHAR(255) PRIMARY KEY,
      reportId VARCHAR(255) NOT NULL,
      userId VARCHAR(255) NOT NULL,
      acknowledgedAt VARCHAR(255) NOT NULL,
      FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id VARCHAR(255) PRIMARY KEY,
      reportId VARCHAR(255) NOT NULL,
      userId VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      createdAt VARCHAR(255) NOT NULL,
      FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS views (
      reportId VARCHAR(255) NOT NULL,
      userId VARCHAR(255) NOT NULL,
      viewedAt VARCHAR(255) NOT NULL,
      PRIMARY KEY (reportId, userId),
      FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(255) PRIMARY KEY,
      userId VARCHAR(255) NOT NULL,
      \`action\` VARCHAR(100) NOT NULL,
      details TEXT,
      timestamp VARCHAR(255) NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id VARCHAR(255) PRIMARY KEY,
      status VARCHAR(50) NOT NULL,
      progress VARCHAR(255),
      result_summary TEXT,
      result_category VARCHAR(50),
      \`result_fullText\` MEDIUMTEXT,
      error TEXT,
      sourceFileUrl VARCHAR(500),
      reportId VARCHAR(255),
      fallbackCategory VARCHAR(50),
      updatedAt VARCHAR(255),
      lockedAt VARCHAR(255),
      attempts INT NOT NULL DEFAULT 0,
      createdAt VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await runMigrations();

  // Insert default agencies if empty
  const [agenciesResult] = await pool.query('SELECT COUNT(*) as count FROM agencies');
  const agenciesCountRows = agenciesResult as any[];
  if (agenciesCountRows[0].count === 0) {
    const defaultAgencies = [
      { id: '1', name: 'กองบริหารสาธารณสุข', description: 'บริหารจัดการภาพรวม', createdAt: new Date().toISOString() },
      { id: '2', name: 'ศูนย์เทคโนโลยีสารสนเทศ', description: 'ดูแลระบบ IT', createdAt: new Date().toISOString() },
    ];
    for (const agency of defaultAgencies) {
      await pool.query(
        'INSERT INTO agencies (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
        [agency.id, agency.name, agency.description, agency.createdAt]
      );
    }
  }

  // Insert default users if not already present
  const checkAndCreateUser = async (id: string, email: string, passwordHash: string, displayName: string, role: string, agencyId: string | null) => {
    const [rows] = await pool.query('SELECT 1 FROM users WHERE id = ?', [id]);
    const userRows = rows as any[];
    if (userRows.length === 0) {
      await pool.query(
        'INSERT INTO users (id, email, displayName, role, agencyId, passwordHash) VALUES (?, ?, ?, ?, ?, ?)',
        [id, email, displayName, role, agencyId, passwordHash]
      );
    }
  };

  await checkAndCreateUser('1', adminEmail, hashPassword(adminPassword), 'ผู้ดูแลระบบ', 'admin', null);
  await checkAndCreateUser('2', execEmail, hashPassword(execPassword), 'ผู้บริหารระดับสูง', 'executive', '1');
  await checkAndCreateUser('3', userEmail, hashPassword(userPassword), 'เจ้าหน้าที่ทั่วไป', 'user', '2');
}

// Authentication Middleware
async function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'เข้าถึงไม่ได้: กรุณาลงชื่อเข้าใช้งาน' });
  }

  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ error: 'Session หมดอายุ หรือไม่มีสิทธิ์เข้าถึง' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, displayName, role, sessionVersion, isActive FROM users WHERE id = ? LIMIT 1',
      [session.id]
    );
    const user = (rows as any[])[0];
    if (!user || !user.isActive || user.role !== session.role || Number(user.sessionVersion) !== session.sessionVersion) {
      return res.status(401).json({ error: 'Session ถูกยกเลิก กรุณาลงชื่อเข้าใช้งานใหม่' });
    }

    (req as any).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      sessionVersion: Number(user.sessionVersion),
    };
    next();
  } catch (error: any) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: 'ไม่สามารถตรวจสอบสิทธิ์การใช้งานได้' });
  }
}

// Role-Based Access Control middleware
function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดำเนินการนี้' });
    }
    next();
  };
}

async function startServer() {
  await initDatabase();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  fs.mkdirSync(runtimeUploadDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  // Security headers — allow same-origin PDF iframe rendering without disabling CSP globally.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: isProduction ? ["'self'"] : ["'self'", "ws:", "http://localhost:*", "http://127.0.0.1:*"],
        frameSrc: ["'self'", "blob:"],
        frameAncestors: ["'self'"],
      },
    },
  }));

  app.use(express.json());
  // Use express-fileupload — limit to 50 MB and store in temp directory
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: tempDir,
    limits: { fileSize: MAX_UPLOAD_BYTES },
    abortOnLimit: true,
    responseOnLimit: JSON.stringify({ error: `ไฟล์มีขนาดใหญ่เกินไป (สูงสุด ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)` })
  }));

  // [FIX-1] Rate limiter: max 10 login attempts per 15 minutes per IP
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'พยายามเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาทีแล้วลองใหม่' }
  });

  // Serve uploads folder statically
  app.use('/uploads', express.static(runtimeUploadDir, {
    fallthrough: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/api/db/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (error: any) {
      res.status(503).json({ status: 'error', error: error.message || 'Database unavailable' });
    }
  });

  // Initialize Gemini API
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  async function processAnalysisJob(jobId: string) {
    const now = new Date().toISOString();
    const [lockResult] = await pool.query(
      'UPDATE analysis_jobs SET status = ?, progress = ?, lockedAt = ?, updatedAt = ?, attempts = attempts + 1 WHERE id = ? AND status = ?',
      ['processing', 'กำลังเตรียมไฟล์เพื่อวิเคราะห์ด้วย AI...', now, now, jobId, 'queued']
    );
    if ((lockResult as any).affectedRows === 0) return;

    const [jobRows] = await pool.query('SELECT * FROM analysis_jobs WHERE id = ?', [jobId]);
    const job = (jobRows as any[])[0];
    if (!job) return;

    const sourcePath = resolveUploadFile(job.sourceFileUrl);
    const fallbackCategory = isValidCategory(job.fallbackCategory) ? job.fallbackCategory : 'agency';
    let localFilePath = '';
    let uploadedFile: any;

    try {
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error('ไม่พบไฟล์ PDF สำหรับวิเคราะห์');
      }

      localFilePath = path.join(tempDir, `${job.id}_report.pdf`);
      await fs.promises.copyFile(sourcePath, localFilePath);

      uploadedFile = await ai.files.upload({
        file: localFilePath,
        config: {
          mimeType: 'application/pdf',
          displayName: `report_${job.id}`,
        },
      });

      await pool.query(
        'UPDATE analysis_jobs SET progress = ?, updatedAt = ? WHERE id = ?',
        ['กำลังวิเคราะห์เนื้อหาด้วย Gemini (อาจใช้เวลาสักครู่หากไฟล์มีขนาดใหญ่)...', new Date().toISOString(), job.id]
      );

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: uploadedFile.uri,
                  mimeType: uploadedFile.mimeType || 'application/pdf',
                },
              },
              { text: REPORT_ANALYSIS_PROMPT },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      let summary = response.text || '';
      let category = fallbackCategory;
      let fullText = '';
      try {
        if (response.text) {
          const json = JSON.parse(response.text);
          summary = normalizeBulletSummary(json.summary || response.text);
          category = isValidCategory(json.category) ? json.category : fallbackCategory;
          fullText = json.fullText || '';
        }
      } catch (e) {
        console.warn('Could not parse JSON from Gemini', e);
        summary = normalizeBulletSummary(summary);
      }

      await pool.query(
        'UPDATE analysis_jobs SET status = ?, progress = ?, result_summary = ?, result_category = ?, `result_fullText` = ?, updatedAt = ? WHERE id = ?',
        ['completed', 'เสร็จสิ้นการวิเคราะห์', summary, category, fullText, new Date().toISOString(), job.id]
      );

      if (job.reportId) {
        await pool.query(
          'UPDATE reports SET summary = ?, category = ?, `fullText` = ?, status = ? WHERE id = ?',
          [summary, category, fullText, 'completed', job.reportId]
        );
      } else {
        await pool.query(
          'UPDATE reports SET summary = ?, category = ?, `fullText` = ?, status = ? WHERE jobId = ?',
          [summary, category, fullText, 'completed', job.id]
        );
      }
    } catch (error: any) {
      const errMsg = error.message || 'Error occurred while analyzing PDF';
      console.error('Background analysis error:', error);
      await pool.query(
        'UPDATE analysis_jobs SET status = ?, progress = ?, error = ?, updatedAt = ? WHERE id = ?',
        ['failed', 'เกิดข้อผิดพลาดในการวิเคราะห์', errMsg, new Date().toISOString(), job.id]
      );
      if (job.reportId) {
        await pool.query('UPDATE reports SET status = ?, summary = ? WHERE id = ?', ['failed', `ไม่สามารถวิเคราะห์ AI ได้: ${errMsg}`, job.reportId]);
      } else {
        await pool.query('UPDATE reports SET status = ?, summary = ? WHERE jobId = ?', ['failed', `ไม่สามารถวิเคราะห์ AI ได้: ${errMsg}`, job.id]);
      }
    } finally {
      if (localFilePath && fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
      if (uploadedFile?.name) {
        try {
          await ai.files.delete({ name: uploadedFile.name });
        } catch {
          console.warn('Could not delete from Gemini api');
        }
      }
    }
  }

  let isProcessingQueuedJobs = false;
  async function processQueuedAnalysisJobs() {
    if (isProcessingQueuedJobs) return;
    isProcessingQueuedJobs = true;
    try {
      const [rows] = await pool.query(
        'SELECT id FROM analysis_jobs WHERE status = ? ORDER BY createdAt ASC LIMIT 3',
        ['queued']
      );
      for (const row of rows as any[]) {
        await processAnalysisJob(row.id);
      }
    } finally {
      isProcessingQueuedJobs = false;
    }
  }

  await pool.query(
    'UPDATE analysis_jobs SET status = ?, progress = ?, lockedAt = NULL, updatedAt = ? WHERE status = ?',
    ['queued', 'กู้คืนงานหลังระบบเริ่มใหม่ รอวิเคราะห์อีกครั้ง...', new Date().toISOString(), 'processing']
  );
  void processQueuedAnalysisJobs();
  setInterval(() => {
    void processQueuedAnalysisJobs();
  }, 15000);

  // Background Jobs state
  app.get("/api/jobs/:id", authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM analysis_jobs WHERE id = ?', [req.params.id]);
      const dbJobs = rows as any[];
      if (dbJobs.length === 0) return res.status(404).json({ error: 'Job not found' });

      const job = dbJobs[0];
      res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        result: job.status === 'completed' ? {
          summary: job.result_summary,
          category: job.result_category,
          fullText: job.result_fullText
        } : undefined,
        error: job.error || undefined
      });
    } catch (error: any) {
      console.error('Fetch job error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while fetching job status' });
    }
  });

  // Authentication Endpoints
  app.post("/api/auth/login", loginLimiter, async (req, res) => { // [FIX-1] rate limited
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
    }
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND isActive = 1', [email]);
      const usersList = rows as any[];
      if (usersList.length === 0) {
        return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
      }
      const user = usersList[0];
      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
      }

      // Password Hash Migration: Upgrades to salted PBKDF2 on first login
      if (!user.passwordHash.includes(':')) {
        const newSaltedHash = hashPassword(password);
        await pool.query('UPDATE users SET passwordHash = ? WHERE id = ?', [newSaltedHash, user.id]);
      }

      const token = signSession({
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        sessionVersion: Number(user.sessionVersion || 1)
      });

      const { passwordHash, ...userProfile } = user;
      res.json({ success: true, token, user: userProfile });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Error occurred during login' });
    }
  });

  app.post("/api/auth/verify-admin", authenticateToken, async (req, res) => {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "กรุณากรอกรหัสผ่าน" });
    }
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE role = ?', ['admin']);
      const admins = rows as any[];
      if (admins.length === 0) {
        const envAdminPassword = process.env.ADMIN_PASSWORD;
        if (envAdminPassword && password === envAdminPassword) {
          return res.json({ success: true });
        }
      } else {
        const adminUser = admins[0];
        if (verifyPassword(password, adminUser.passwordHash)) {
          return res.json({ success: true });
        }
      }
      res.status(401).json({ error: "รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง" });
    } catch (error: any) {
      console.error('Verify admin error:', error);
      res.status(500).json({ error: error.message || 'Error occurred during admin verification' });
    }
  });

  // Global Data Fetch
  app.get("/api/data", authenticateToken, async (req, res) => {
    try {
      const [
        [users],
        [agencies],
        [reports],
        [acknowledgments],
        [comments],
        [views],
        [auditLogs]
      ] = await Promise.all([
        pool.query('SELECT id, email, displayName, role, agencyId, avatarUrl FROM users WHERE isActive = 1'),
        pool.query('SELECT * FROM agencies'),
        pool.query('SELECT id, title, category, agencyId, fileUrl, summary, uploadedBy, uploadedAt, status, jobId FROM reports'),
        pool.query('SELECT * FROM acknowledgments'),
        pool.query('SELECT * FROM comments'),
        pool.query('SELECT * FROM views'),
        pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500')
      ]);

      res.json({
        users,
        agencies,
        reports,
        acknowledgments,
        comments,
        views,
        auditLogs
      });
    } catch (error: any) {
      console.error('Error fetching global data:', error);
      res.status(500).json({ error: error.message || 'Error fetching data from database' });
    }
  });

  // Lightweight reports list fetch (used after upload to avoid refetching everything)
  app.get("/api/reports", authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, title, category, agencyId, fileUrl, summary, uploadedBy, uploadedAt, status, jobId FROM reports ORDER BY uploadedAt DESC'
      );
      res.json(rows);
    } catch (error: any) {
      console.error('Error fetching reports list:', error);
      res.status(500).json({ error: error.message || 'Error fetching reports' });
    }
  });

  // Get single report detail (includes fullText)
  app.get("/api/reports/:id", authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
      const reportsList = rows as any[];
      if (reportsList.length === 0) return res.status(404).json({ error: 'Report not found' });
      res.json(reportsList[0]);
    } catch (error: any) {
      console.error('Fetch report detail error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while fetching report details' });
    }
  });

  // Retry report analysis (in case of 503 Gemini overload or fail)
  app.post("/api/reports/:id/retry", authenticateToken, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
      const reportsList = rows as any[];
      if (reportsList.length === 0) return res.status(404).json({ error: 'Report not found' });
      const report = reportsList[0];

      const jobId = `job_${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      // Mark report status as processing
      await pool.query(
        'UPDATE reports SET status = ?, summary = ?, jobId = ? WHERE id = ?',
        ['processing', 'กำลังเริ่มวิเคราะห์ใหม่ด้วย AI...', jobId, report.id]
      );

      await pool.query(
        'INSERT INTO analysis_jobs (id, status, progress, sourceFileUrl, reportId, fallbackCategory, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [jobId, 'queued', 'รอคิววิเคราะห์ด้วย AI...', report.fileUrl, report.id, report.category, now, now]
      );

      res.json({ success: true, jobId });
      void processQueuedAnalysisJobs();

    } catch (error: any) {
      console.error('Retry error:', error);
      res.status(500).json({ error: error.message || 'Error occurred during retry process' });
    }
  });

  // User Administration Endpoints — admin only
  app.post("/api/users", authenticateToken, requireRole('admin'), async (req, res) => {
    const { user, password } = req.body;
    if (!user?.email || !user?.displayName || !isValidRole(user.role)) {
      return res.status(400).json({ error: 'ข้อมูลผู้ใช้งานไม่ครบถ้วนหรือ role ไม่ถูกต้อง' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    }
    try {
      const [existing] = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)', [user.email]);
      if ((existing as any[]).length > 0) {
        return res.status(400).json({ error: "อีเมลผู้ใช้งานนี้มีอยู่ในระบบแล้ว" });
      }

      const passwordHash = hashPassword(password);
      await pool.query(
        'INSERT INTO users (id, email, displayName, role, agencyId, avatarUrl, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), user.email, user.displayName, user.role, user.agencyId || null, user.avatarUrl || null, passwordHash]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Create user error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while creating user' });
    }
  });

  app.put("/api/users/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    const { user, password } = req.body;
    if (!user?.email || !user?.displayName || !isValidRole(user.role)) {
      return res.status(400).json({ error: 'ข้อมูลผู้ใช้งานไม่ครบถ้วนหรือ role ไม่ถูกต้อง' });
    }
    if (password && String(password).length < 8) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
    }
    try {
      const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
      const usersList = existing as any[];
      if (usersList.length === 0) return res.status(404).json({ error: "User not found" });

      const oldUser = usersList[0];
      const passwordHash = password ? hashPassword(password) : oldUser.passwordHash;

      await pool.query(
        'UPDATE users SET email = ?, displayName = ?, role = ?, agencyId = ?, avatarUrl = ?, passwordHash = ?, sessionVersion = sessionVersion + 1 WHERE id = ?',
        [user.email, user.displayName, user.role, user.agencyId || null, user.avatarUrl || null, passwordHash, req.params.id]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while updating user' });
    }
  });

  app.delete("/api/users/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    const currentUserId = (req as any).user.id;
    if (currentUserId === req.params.id) {
      return res.status(400).json({ error: "คุณไม่สามารถลบผู้ใช้งานของตนเองได้" });
    }
    try {
      await pool.query('UPDATE users SET isActive = 0, sessionVersion = sessionVersion + 1 WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while deleting user' });
    }
  });

  // Agencies Endpoints — admin only
  app.post("/api/agencies", authenticateToken, requireRole('admin'), async (req, res) => {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'กรุณาระบุชื่อหน่วยงาน' });
    }
    try {
      await pool.query(
        'INSERT INTO agencies (id, name, description, createdAt) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), name, description || null, new Date().toISOString()]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Create agency error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while creating agency' });
    }
  });

  app.put("/api/agencies/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    const { name, description } = req.body;
    try {
      await pool.query(
        'UPDATE agencies SET name = ?, description = ? WHERE id = ?',
        [name, description || null, req.params.id]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Update agency error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while updating agency' });
    }
  });

  app.delete("/api/agencies/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      await pool.query('DELETE FROM agencies WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete agency error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while deleting agency' });
    }
  });

  // Reports Endpoints
  app.post("/api/reports", authenticateToken, async (req, res) => {
    const currentUser = getUser(req);
    const { title, category, agencyId, fileUrl, summary, fullText, status, jobId } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'กรุณาระบุชื่อรายงาน' });
    }
    if (!isValidCategory(category)) {
      return res.status(400).json({ error: 'หมวดหมู่รายงานไม่ถูกต้อง' });
    }
    if (!agencyId || typeof agencyId !== 'string') {
      return res.status(400).json({ error: 'กรุณาระบุหน่วยงาน' });
    }
    if (!resolveUploadFile(fileUrl)) {
      return res.status(400).json({ error: 'ที่อยู่ไฟล์ไม่ถูกต้อง' });
    }
    try {
      let resolvedSummary = summary || null;
      let resolvedFullText = fullText || null;
      let resolvedCategory = category;
      let resolvedStatus = status || null;

      if (jobId) {
        const [jobRows] = await pool.query('SELECT * FROM analysis_jobs WHERE id = ?', [jobId]);
        const job = (jobRows as any[])[0];
        if (job?.status === 'completed') {
          resolvedSummary = job.result_summary || resolvedSummary;
          resolvedFullText = job.result_fullText || resolvedFullText;
          resolvedCategory = isValidCategory(job.result_category) ? job.result_category : resolvedCategory;
          resolvedStatus = 'completed';
        } else if (job?.status === 'failed') {
          resolvedSummary = job.error ? `ไม่สามารถวิเคราะห์ AI ได้: ${job.error}` : resolvedSummary;
          resolvedStatus = 'failed';
        }
      }

      const createdReport = {
        id: crypto.randomUUID(),
        title,
        category: resolvedCategory,
        agencyId,
        fileUrl,
        summary: resolvedSummary,
        fullText: resolvedFullText,
        uploadedBy: currentUser.id,
        uploadedAt: new Date().toISOString(),
        status: resolvedStatus,
        jobId: jobId || null,
      };
      await pool.query(
        'INSERT INTO reports (id, title, category, agencyId, fileUrl, summary, `fullText`, uploadedBy, uploadedAt, status, jobId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          createdReport.id,
          createdReport.title,
          createdReport.category,
          createdReport.agencyId,
          createdReport.fileUrl,
          createdReport.summary,
          createdReport.fullText,
          createdReport.uploadedBy,
          createdReport.uploadedAt,
          createdReport.status,
          createdReport.jobId,
        ]
      );
      res.json({ success: true, report: createdReport });
    } catch (error: any) {
      console.error('Create report error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while creating report' });
    }
  });

  app.put("/api/reports/:id", authenticateToken, async (req, res) => {
    const currentUser = getUser(req);
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขรายงาน' });
    }
    try {
      const [existing] = await pool.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
      const reports = existing as any[];
      if (reports.length === 0) return res.status(404).json({ error: "Report not found" });

      const mergedReport = { ...reports[0], ...req.body };
      if (!isValidCategory(mergedReport.category)) {
        return res.status(400).json({ error: 'หมวดหมู่รายงานไม่ถูกต้อง' });
      }
      await pool.query(
        'UPDATE reports SET title = ?, category = ?, agencyId = ?, summary = ?, `fullText` = ?, status = ?, jobId = ? WHERE id = ?',
        [
          mergedReport.title,
          mergedReport.category,
          mergedReport.agencyId,
          mergedReport.summary,
          mergedReport.fullText,
          mergedReport.status,
          mergedReport.jobId,
          req.params.id
        ]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Update report error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while updating report' });
    }
  });

  app.delete("/api/reports/:id", authenticateToken, requireRole('admin'), async (req, res) => { // [FIX-4] admin only
    const { adminPassword } = req.body;
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE role = ?', ['admin']);
      const admins = rows as any[];
      const validPassword = admins.length > 0 ? admins[0].passwordHash : null;
      if (!validPassword || !verifyPassword(adminPassword, validPassword)) {
        return res.status(401).json({ error: "รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง" });
      }

      const [reportRows] = await pool.query('SELECT fileUrl FROM reports WHERE id = ?', [req.params.id]);
      const report = (reportRows as any[])[0];
      await pool.query('DELETE FROM reports WHERE id = ?', [req.params.id]);
      const filePath = report?.fileUrl ? resolveUploadFile(report.fileUrl) : null;
      if (filePath) unlinkIfExists(filePath);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete report error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while deleting report' });
    }
  });

  // Acknowledgments, Comments, Views, Logs Endpoints
  app.post("/api/acknowledgments", authenticateToken, async (req, res) => {
    const currentUser = getUser(req);
    const { reportId } = req.body;
    if (currentUser.role !== 'executive') {
      return res.status(403).json({ error: 'เฉพาะผู้บริหารเท่านั้นที่รับทราบรายงานได้' });
    }
    try {
      const [existing] = await pool.query('SELECT 1 FROM acknowledgments WHERE reportId = ? AND userId = ?', [reportId, currentUser.id]);
      if ((existing as any[]).length > 0) {
        return res.json({ success: true });
      }
      await pool.query(
        'INSERT INTO acknowledgments (id, reportId, userId, acknowledgedAt) VALUES (?, ?, ?, ?)',
        [crypto.randomUUID(), reportId, currentUser.id, new Date().toISOString()]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Create acknowledgment error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while saving acknowledgment' });
    }
  });

  app.post("/api/comments", authenticateToken, async (req, res) => {
    const currentUser = getUser(req);
    const { reportId, content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length > 5000) {
      return res.status(400).json({ error: 'ความคิดเห็นไม่ถูกต้องหรือยาวเกินไป' });
    }
    try {
      await pool.query(
        'INSERT INTO comments (id, reportId, userId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), reportId, currentUser.id, content.trim(), new Date().toISOString()]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Create comment error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while saving comment' });
    }
  });

  app.post("/api/views", authenticateToken, async (req, res) => {
    const currentUser = getUser(req);
    const { reportId } = req.body;
    try {
      const [existing] = await pool.query('SELECT 1 FROM views WHERE reportId = ? AND userId = ?', [reportId, currentUser.id]);
      if ((existing as any[]).length === 0) {
        await pool.query(
          'INSERT INTO views (reportId, userId, viewedAt) VALUES (?, ?, ?)',
          [reportId, currentUser.id, new Date().toISOString()]
        );
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Create view error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while saving view record' });
    }
  });

  app.post("/api/audit-logs", authenticateToken, async (req, res) => {
    const currentUser = getUser(req);
    const { action, details } = req.body;
    const validActions = new Set(['login', 'upload_report', 'acknowledge_report', 'view_report', 'update_report', 'delete_report']);
    if (!validActions.has(action)) {
      return res.status(400).json({ error: 'Invalid audit action' });
    }
    try {
      await pool.query(
        'INSERT INTO audit_logs (id, userId, `action`, details, timestamp) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), currentUser.id, action, String(details || '').slice(0, 2000), new Date().toISOString()]
      );
      res.json({ success: true });
    } catch (error: any) {
      console.error('Create audit log error:', error);
      res.status(500).json({ error: error.message || 'Error occurred while saving audit log' });
    }
  });

  // PDF Analysis Endpoint (Async Queue System)
  app.post("/api/analyze-pdf", authenticateToken, async (req, res) => {
    try {
      let sourceFileUrl = req.body?.fileUrl;
      const jobId = `job_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const fallbackCategory = isValidCategory(req.body?.category) ? req.body.category : 'agency';

      if (sourceFileUrl) {
        const sourcePath = resolveUploadFile(sourceFileUrl);
        if (!sourcePath) {
          return res.status(400).json({ error: 'Invalid file path' });
        }
        if (!fs.existsSync(sourcePath)) {
          return res.status(400).json({ error: `File not found on server at: ${sourcePath}` });
        }
      } else {
        if (!req.files || Object.keys(req.files).length === 0) {
          return res.status(400).json({ error: 'No files were uploaded.' });
        }

        const files = req.files as fileUpload.FileArray;
        const file = files.report as fileUpload.UploadedFile;
        if (!file) {
           return res.status(400).json({ error: 'File field "report" missing' });
        }

        const buffer = await fs.promises.readFile(file.tempFilePath);
        const fileTypeMeta = await fileTypeFromBuffer(buffer.subarray(0, 4100));
        if (!fileTypeMeta || fileTypeMeta.mime !== 'application/pdf') {
          fs.unlink(file.tempFilePath, () => {});
          return res.status(400).json({ error: 'ไฟล์ที่อัปโหลดต้องเป็น PDF เท่านั้น' });
        }

        const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${Date.now()}_${safeName.endsWith('.pdf') ? safeName : safeName + '.pdf'}`;
        const finalPath = path.join(runtimeUploadDir, fileName);
        await fs.promises.copyFile(file.tempFilePath, finalPath);
        sourceFileUrl = `/uploads/${fileName}`;
      }

      await pool.query(
        'INSERT INTO analysis_jobs (id, status, progress, sourceFileUrl, fallbackCategory, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [jobId, 'queued', 'รอคิววิเคราะห์ด้วย AI...', sourceFileUrl, fallbackCategory, now, now]
      );

      res.json({ jobId, status: 'queued', message: 'Analysis queued', fileUrl: sourceFileUrl });
      void processQueuedAnalysisJobs();

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Error occurred while reading PDF file' });
    }
  });

  // Upload Endpoint — stores PDF locally and serves as static
  app.post("/api/upload", authenticateToken, async (req, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
      }
      const files = req.files as fileUpload.FileArray;
      const file = files.report as fileUpload.UploadedFile;

      // [FIX-2] Validate MIME type by reading magic bytes from temp file
      const buffer = await fs.promises.readFile(file.tempFilePath);
      const fileTypeMeta = await fileTypeFromBuffer(buffer.subarray(0, 4100));
      if (!fileTypeMeta || fileTypeMeta.mime !== 'application/pdf') {
        fs.unlink(file.tempFilePath, () => {});
        return res.status(400).json({ error: 'ไฟล์ที่อัปโหลดต้องเป็น PDF เท่านั้น' });
      }

      const uploadPath = runtimeUploadDir;
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Sanitize filename — strip path separators, force .pdf extension
      const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${safeName.endsWith('.pdf') ? safeName : safeName + '.pdf'}`;
      const finalPath = path.join(uploadPath, fileName);

      file.mv(finalPath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ fileUrl: `/uploads/${fileName}` });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // @ts-ignore
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Provide virtual path for uploads if needed, public is part of dist
    // Actually vite dist won't contain runtime uploads easily, but we'll deal with it for this dev demo.
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
