/**
 * Print Server — polls print_jobs table and sends ESC/POS payloads to printers.
 *
 * Connection types:
 *   - LAN: TCP socket to printer IP:port (default 9100)
 *   - USB: writes to a file (simulating Windows RawPrinter) — on real Windows,
 *          this would use PowerShell RawPrinterHelper. Here we write to /tmp
 *          for testing purposes.
 *
 * Retry logic:
 *   - On failure: increment attempts
 *   - If attempts < retry_count: status stays 'pending' (will retry on next poll)
 *   - If attempts >= retry_count: status becomes 'failed'
 *
 * Polling: every 2 seconds, fetches PENDING jobs ordered by queued_at ASC.
 */

const mysql = require('mysql2/promise');
const net = require('net');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load backend .env
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const POLL_INTERVAL_MS = 2000;
const PRINT_OUTPUT_DIR = '/tmp/printer-output';

// Ensure output dir exists (for USB simulation)
if (!fs.existsSync(PRINT_OUTPUT_DIR)) {
  fs.mkdirSync(PRINT_OUTPUT_DIR, { recursive: true });
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '4000'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4',
  connectionLimit: 5,
  ssl: { rejectUnauthorized: false },
});

const log = (msg, data) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`, data ?? '');
};

async function sendToLanPrinter(ip, port, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    let connected = false;

    socket.on('connect', () => {
      connected = true;
      socket.write(Buffer.from(payload, 'hex'), () => {
        socket.end();
        resolve({ ok: true });
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Connection timeout to ${ip}:${port}`));
    });

    socket.on('error', (err) => {
      reject(new Error(`Socket error: ${err.message}`));
    });

    socket.on('close', () => {
      if (!connected) {
        reject(new Error(`Could not connect to ${ip}:${port}`));
      }
    });

    socket.connect(port, ip);
  });
}

async function sendToUsbPrinter(usbName, payload) {
  // Simulate USB printing by writing to a file
  // On real Windows: use PowerShell RawPrinterHelper
  return new Promise((resolve, reject) => {
    const filename = path.join(PRINT_OUTPUT_DIR, `${usbName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.bin`);
    fs.writeFile(filename, Buffer.from(payload, 'hex'), (err) => {
      if (err) {
        reject(new Error(`USB write failed: ${err.message}`));
      } else {
        resolve({ ok: true, file: filename });
      }
    });
  });
}

async function processPrintJob(job) {
  const { id, printer_id, payload, attempts, retry_count, timeout_ms } = job;

  // Fetch printer details
  const [printers] = await pool.query(
    `SELECT name, station, connection_type, ip_address, port, usb_name, enabled
       FROM printers WHERE id = ? AND deleted_at IS NULL`,
    [printer_id]
  );
  if (printers.length === 0) {
    log(`Job ${id}: printer ${printer_id} not found — marking failed`);
    await pool.execute(
      `UPDATE print_jobs SET status = 'failed', last_error = 'Printer not found', attempts = attempts + 1 WHERE id = ?`,
      [id]
    );
    return;
  }

  const printer = printers[0];
  if (!printer.enabled) {
    log(`Job ${id}: printer ${printer.name} is disabled — skipping`);
    await pool.execute(
      `UPDATE print_jobs SET last_error = 'Printer disabled', attempts = attempts + 1 WHERE id = ?`,
      [id]
    );
    return;
  }

  // Mark as printing
  await pool.execute(`UPDATE print_jobs SET status = 'printing' WHERE id = ?`, [id]);

  try {
    let result;
    if (printer.connection_type === 'lan') {
      if (!printer.ip_address || !printer.port) {
        throw new Error(`LAN printer ${printer.name} has no IP/port configured`);
      }
      result = await sendToLanPrinter(printer.ip_address, printer.port, payload, timeout_ms);
    } else {
      // USB
      if (!printer.usb_name) {
        throw new Error(`USB printer ${printer.name} has no USB name configured`);
      }
      result = await sendToUsbPrinter(printer.usb_name, payload);
    }

    // Success — mark as printed
    await pool.execute(
      `UPDATE print_jobs SET status = 'printed', printed_at = NOW(3), attempts = attempts + 1 WHERE id = ?`,
      [id]
    );
    log(`Job ${id}: PRINTED on ${printer.name} (${printer.connection_type})`, result.file ?? '');
  } catch (err) {
    const newAttempts = attempts + 1;
    const maxRetries = retry_count || 3;
    const willRetry = newAttempts < maxRetries;
    const newStatus = willRetry ? 'pending' : 'failed';

    await pool.execute(
      `UPDATE print_jobs SET status = ?, attempts = ?, last_error = ? WHERE id = ?`,
      [newStatus, newAttempts, err.message.substring(0, 500), id]
    );

    log(`Job ${id}: ${willRetry ? 'RETRY' : 'FAILED'} (attempt ${newAttempts}/${maxRetries}) on ${printer.name}: ${err.message}`);
  }
}

async function pollAndProcess() {
  try {
    // Fetch pending jobs
    const [jobs] = await pool.query(
      `SELECT pj.id, pj.printer_id, pj.type, pj.payload, pj.attempts,
              p.retry_count, p.timeout_ms, p.name AS printer_name
         FROM print_jobs pj
         JOIN printers p ON p.id = pj.printer_id
        WHERE pj.status = 'pending'
          AND p.enabled = 1
          AND p.deleted_at IS NULL
        ORDER BY pj.queued_at ASC
        LIMIT 10`
    );

    if (jobs.length > 0) {
      log(`Processing ${jobs.length} pending print jobs...`);
      // Process sequentially (printers don't handle parallel well)
      for (const job of jobs) {
        await processPrintJob(job);
      }
    }
  } catch (err) {
    log(`Poll error: ${err.message}`);
  }
}

async function main() {
  log('=== Print Server starting ===');
  log(`DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`);
  log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  log(`USB output dir: ${PRINT_OUTPUT_DIR}`);

  // Verify DB connection
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    log('Database connection OK');
  } catch (err) {
    log(`Database connection FAILED: ${err.message}`);
    process.exit(1);
  }

  // Start polling
  log('Starting poll loop...');
  setInterval(pollAndProcess, POLL_INTERVAL_MS);
  // Run immediately
  pollAndProcess();
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
