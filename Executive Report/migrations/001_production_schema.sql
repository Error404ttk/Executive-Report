CREATE TABLE IF NOT EXISTS agencies (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  createdAt VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  agencyId VARCHAR(255) NOT NULL,
  fileUrl VARCHAR(500) NOT NULL,
  summary TEXT,
  `fullText` MEDIUMTEXT,
  uploadedBy VARCHAR(255) NOT NULL,
  uploadedAt VARCHAR(255) NOT NULL,
  status VARCHAR(50),
  jobId VARCHAR(255),
  INDEX idx_reports_category_uploaded_at (category, uploadedAt),
  INDEX idx_reports_job_id (jobId),
  FOREIGN KEY (agencyId) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS acknowledgments (
  id VARCHAR(255) PRIMARY KEY,
  reportId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  acknowledgedAt VARCHAR(255) NOT NULL,
  UNIQUE INDEX uniq_ack_report_user (reportId, userId),
  FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(255) PRIMARY KEY,
  reportId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  createdAt VARCHAR(255) NOT NULL,
  INDEX idx_comments_report_created (reportId, createdAt),
  FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS views (
  reportId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  viewedAt VARCHAR(255) NOT NULL,
  PRIMARY KEY (reportId, userId),
  INDEX idx_views_report (reportId),
  FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  details TEXT,
  timestamp VARCHAR(255) NOT NULL,
  INDEX idx_audit_logs_timestamp (timestamp),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) NOT NULL,
  progress VARCHAR(255),
  result_summary TEXT,
  result_category VARCHAR(50),
  `result_fullText` MEDIUMTEXT,
  error TEXT,
  sourceFileUrl VARCHAR(500),
  reportId VARCHAR(255),
  fallbackCategory VARCHAR(50),
  updatedAt VARCHAR(255),
  lockedAt VARCHAR(255),
  attempts INT NOT NULL DEFAULT 0,
  createdAt VARCHAR(255) NOT NULL,
  INDEX idx_analysis_jobs_status_updated (status, updatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
