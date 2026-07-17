import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { makePassword, normalizeUsername } from './auth.mjs';

const { Pool } = pg;
const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

function accountFromRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    usernameNormalized: row.username_normalized,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    enabled: row.enabled,
    maxDevices: Number(row.max_devices),
    sessionVersion: Number(row.session_version),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

function deviceFromRow(row) {
  return {
    id: Number(row.id),
    deviceId: row.device_id,
    deviceName: row.device_name || '',
    userAgent: row.user_agent || '',
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at
  };
}

function loginEventFromRow(row) {
  return {
    id: Number(row.id),
    deviceId: row.device_id,
    deviceName: row.device_name || '',
    ipAddress: row.ip_address || '',
    userAgent: row.user_agent || '',
    loggedInAt: row.logged_in_at
  };
}

export class PgAccountStore {
  constructor(connectionString) {
    if (!connectionString) throw new Error('DATABASE_URL 未配置');
    this.pool = new Pool({ connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } });
  }

  async init() {
    const sql = await readFile(schemaPath, 'utf8');
    await this.pool.query(sql);
  }

  async close() { await this.pool.end(); }
  async healthCheck() { await this.pool.query('SELECT 1'); return true; }

  async getAccountByUsername(username) {
    const result = await this.pool.query('SELECT * FROM accounts WHERE username_normalized=$1', [normalizeUsername(username)]);
    return accountFromRow(result.rows[0]);
  }

  async getAccountById(id) {
    const result = await this.pool.query('SELECT * FROM accounts WHERE id=$1', [id]);
    return accountFromRow(result.rows[0]);
  }

  async bindDevice(accountId, device) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const accountResult = await client.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE', [accountId]);
      const account = accountFromRow(accountResult.rows[0]);
      if (!account || !account.enabled) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'ACCOUNT_DISABLED' };
      }
      const existing = await client.query('SELECT * FROM devices WHERE account_id=$1 AND device_id=$2', [accountId, device.deviceId]);
      if (existing.rows[0]) {
        await client.query(
          'UPDATE devices SET device_name=$3,user_agent=$4,last_seen_at=NOW() WHERE account_id=$1 AND device_id=$2',
          [accountId, device.deviceId, device.deviceName || '', device.userAgent || '']
        );
        await client.query('COMMIT');
        return { ok: true, bound: false, count: null, maxDevices: account.maxDevices };
      }
      const countResult = await client.query('SELECT COUNT(*)::int AS count FROM devices WHERE account_id=$1', [accountId]);
      const count = Number(countResult.rows[0].count);
      if (count >= account.maxDevices) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'DEVICE_LIMIT', count, maxDevices: account.maxDevices };
      }
      await client.query(
        'INSERT INTO devices(account_id,device_id,device_name,user_agent) VALUES($1,$2,$3,$4)',
        [accountId, device.deviceId, device.deviceName || '', device.userAgent || '']
      );
      await client.query('COMMIT');
      return { ok: true, bound: true, count: count + 1, maxDevices: account.maxDevices };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async touchLogin(accountId) {
    await this.pool.query('UPDATE accounts SET last_login_at=NOW() WHERE id=$1', [accountId]);
  }

  async recordLogin(accountId, login) {
    await this.pool.query(
      `INSERT INTO login_events(account_id,device_id,device_name,ip_address,user_agent)
       VALUES($1,$2,$3,$4,$5)`,
      [accountId, login.deviceId, login.deviceName || '', login.ipAddress || '', login.userAgent || '']
    );
  }

  async validateSession(accountId, deviceId, sessionVersion) {
    const result = await this.pool.query(
      `SELECT a.*,d.id AS device_row_id FROM accounts a
       LEFT JOIN devices d ON d.account_id=a.id AND d.device_id=$2
       WHERE a.id=$1`,
      [accountId, deviceId]
    );
    const row = result.rows[0];
    if (!row || !row.enabled || Number(row.session_version) !== Number(sessionVersion) || !row.device_row_id) return null;
    await this.pool.query('UPDATE devices SET last_seen_at=NOW() WHERE id=$1', [row.device_row_id]);
    return accountFromRow(row);
  }

  async createAccount({ username, password, maxDevices = 3 }) {
    const normalized = normalizeUsername(username);
    const credentials = await makePassword(password);
    const result = await this.pool.query(
      `INSERT INTO accounts(username,username_normalized,password_hash,password_salt,max_devices)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [String(username).trim(), normalized, credentials.hash, credentials.salt, maxDevices]
    );
    return accountFromRow(result.rows[0]);
  }

  async listAccounts() {
    const [accountsResult, devicesResult, loginsResult] = await Promise.all([
      this.pool.query('SELECT * FROM accounts ORDER BY created_at DESC'),
      this.pool.query('SELECT * FROM devices ORDER BY last_seen_at DESC'),
      this.pool.query(
        `SELECT * FROM (
           SELECT login_events.*,ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY logged_in_at DESC) AS account_row
           FROM login_events
         ) recent WHERE account_row<=100 ORDER BY logged_in_at DESC`
      )
    ]);
    const devicesByAccount = new Map();
    for (const row of devicesResult.rows) {
      const list = devicesByAccount.get(Number(row.account_id)) || [];
      list.push(deviceFromRow(row));
      devicesByAccount.set(Number(row.account_id), list);
    }
    const loginsByAccount = new Map();
    for (const row of loginsResult.rows) {
      const list = loginsByAccount.get(Number(row.account_id)) || [];
      list.push(loginEventFromRow(row));
      loginsByAccount.set(Number(row.account_id), list);
    }
    return accountsResult.rows.map(row => ({
      ...accountFromRow(row),
      devices: devicesByAccount.get(Number(row.id)) || [],
      loginEvents: loginsByAccount.get(Number(row.id)) || []
    }));
  }

  async updateAccount(id, patch) {
    const fields = [];
    const values = [];
    if (typeof patch.enabled === 'boolean') { values.push(patch.enabled); fields.push(`enabled=$${values.length}`); }
    if (patch.maxDevices != null) { values.push(patch.maxDevices); fields.push(`max_devices=$${values.length}`); }
    if (!fields.length) return this.getAccountById(id);
    if (patch.enabled === false) fields.push('session_version=session_version+1');
    values.push(id);
    const result = await this.pool.query(`UPDATE accounts SET ${fields.join(',')} WHERE id=$${values.length} RETURNING *`, values);
    return accountFromRow(result.rows[0]);
  }

  async resetPassword(id, password) {
    const credentials = await makePassword(password);
    const result = await this.pool.query(
      `UPDATE accounts SET password_hash=$1,password_salt=$2,session_version=session_version+1
       WHERE id=$3 RETURNING *`,
      [credentials.hash, credentials.salt, id]
    );
    return accountFromRow(result.rows[0]);
  }

  async resetDevices(id) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const deleted = await client.query('DELETE FROM devices WHERE account_id=$1', [id]);
      await client.query('UPDATE accounts SET session_version=session_version+1 WHERE id=$1', [id]);
      await client.query('COMMIT');
      return deleted.rowCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
