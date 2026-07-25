/**
 * Creates and seeds data/silent-signal.db.
 *
 * Refuses to touch an existing database unless --force is passed: this file
 * holds real state once the app is running, and a silent re-seed would discard
 * members, teams and webhooks someone configured.
 */
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

/** Mirrors lib/auth/password.ts — the seed cannot import a server-only module. */
async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password.normalize('NFKC'), salt, 64)
  return ['scrypt', 32768, 8, 1, salt.toString('base64'), derived.toString('base64')].join('$')
}

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'admin123'
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@silentsignal.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dbPath = resolve(root, 'data/silent-signal.db')
const force = process.argv.includes('--force')

const usePostgres = Boolean(process.env.DATABASE_URL)

if (!usePostgres && existsSync(dbPath) && !force) {
  console.log('silent-signal.db already exists — leaving it alone (use --force to reset)')
  process.exit(0)
}

const tenancy = await import(pathToFileURL(resolve(root, 'db/content/seed-tenancy.ts')).href)
const delivery = await import(pathToFileURL(resolve(root, 'db/content/seed-delivery.ts')).href)

/**
 * Minimal execute/prepare shim so the rest of this script does not care which
 * database it is talking to. `?` placeholders are translated for Postgres.
 */
async function openTarget() {
  if (!usePostgres) {
    mkdirSync(dirname(dbPath), { recursive: true })
    if (force) {
      // WAL leaves sidecar files; removing only the main file would resurrect rows.
      for (const suffix of ['', '-wal', '-shm']) rmSync(`${dbPath}${suffix}`, { force: true })
    }
    const db = new DatabaseSync(dbPath)
    db.exec(readFileSync(resolve(root, 'db/app-schema.sql'), 'utf8'))
    return {
      label: dbPath,
      prepare: (sql) => ({ run: (...params) => db.prepare(sql).run(...params) }),
      exec: (sql) => db.exec(sql),
      count: (table) => db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,
      close: () => db.close(),
    }
  }

  const { Client } = await import('pg')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(readFileSync(resolve(root, 'db/app-schema.postgres.sql'), 'utf8'))
  if (force) {
    await client.query(`TRUNCATE organization, workspace, member, team, member_workspace,
      member_team, invitation, integration, webhook_endpoint, notification, audit_log,
      sprint, release, qa_item, qa_tester, rule, risk_event, signal, service_health,
      dashboard_metrics, billing RESTART IDENTITY CASCADE`)
  } else {
    const existing = await client.query('SELECT count(*) AS n FROM member')
    if (Number(existing.rows[0].n) > 0) {
      console.log('Postgres database already has members — leaving it alone (use --force to reset)')
      await client.end()
      process.exit(0)
    }
  }

  const positional = (sql) => {
    let text = sql
    if (/INSERT OR IGNORE/i.test(text)) {
      text = text.replace(/INSERT OR IGNORE/gi, 'INSERT') + ' ON CONFLICT DO NOTHING'
    }
    let i = 0
    return text.replace(/\?/g, () => `$${++i}`)
  }
  const queue = []
  return {
    label: 'postgres',
    prepare: (sql) => ({ run: (...params) => queue.push([positional(sql), params]) }),
    exec: async (sql) => { if (!['BEGIN', 'COMMIT', 'ROLLBACK', 'VACUUM'].includes(sql)) await client.query(sql) },
    flush: async () => {
      await client.query('BEGIN')
      try {
        for (const [text, params] of queue) await client.query(text, params)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    },
    count: async (table) => Number((await client.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n),
    close: () => client.end(),
  }
}

const db = await openTarget()

const iso = (value) => (value ? new Date(value).toISOString() : null)
const bit = (value) => (usePostgres ? Boolean(value) : value ? 1 : 0)

await db.exec('BEGIN')
try {
  const org = tenancy.seedOrganization
  db.prepare(
    `INSERT INTO organization (id, name, slug, logo, plan, sso_enabled, sso_provider,
                               verified_domains, settings, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(org.id, org.name, org.slug, org.logo ?? null, org.plan, bit(org.ssoEnabled),
        org.ssoProvider ?? null, JSON.stringify(org.verifiedDomains),
        JSON.stringify(org.settings), iso(org.createdAt))

  const insertWorkspace = db.prepare(
    `INSERT INTO workspace (id, organization_id, name, slug, description, status,
                            integration_ids, created_at, updated_at, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const ws of tenancy.seedWorkspaces) {
    insertWorkspace.run(ws.id, ws.organizationId, ws.name, ws.slug, ws.description ?? null,
      ws.status, JSON.stringify(ws.integrationIds), iso(ws.createdAt), iso(ws.updatedAt),
      iso(ws.archivedAt))
  }

  const demoHash = await hashPassword(DEMO_PASSWORD)
  const adminHash = await hashPassword(ADMIN_PASSWORD)

  const insertMember = db.prepare(
    `INSERT INTO member (id, organization_id, user_id, email, name, avatar, role_id, status,
                         email_verified_at, invited_by_id, invited_at, approved_by_id,
                         approved_at, last_active_at, password_hash, must_change_password,
                         password_changed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const linkWorkspace = db.prepare(
    'INSERT OR IGNORE INTO member_workspace (member_id, workspace_id) VALUES (?, ?)',
  )
  for (const member of tenancy.seedMembers) {
    insertMember.run(member.id, member.organizationId, member.userId, member.email, member.name,
      member.avatar ?? null, member.roleId, member.status, iso(member.emailVerifiedAt),
      member.invitedById ?? null, iso(member.invitedAt), member.approvedById ?? null,
      iso(member.approvedAt), iso(member.lastActiveAt), demoHash, 0, iso(member.createdAt),
      iso(member.createdAt))
    for (const workspaceId of member.workspaceIds) linkWorkspace.run(member.id, workspaceId)
  }

  // A dedicated administrator, separate from the demo personas: it is the
  // account you actually sign in with, and it is flagged so the app insists on
  // a real password before the handed-out one is used for anything.
  const adminId = 'mem-admin'
  insertMember.run(adminId, org.id, 'user-admin', ADMIN_EMAIL, 'Administrator', 'AD',
    'org_owner', 'approved', new Date().toISOString(), null, null, null,
    new Date().toISOString(), null, adminHash, 1, null, new Date().toISOString())
  for (const ws of tenancy.seedWorkspaces) {
    if (ws.status === 'active') linkWorkspace.run(adminId, ws.id)
  }

  // Teams reference members (release manager, QA lead), so they come after.
  const insertTeam = db.prepare(
    `INSERT INTO team (id, organization_id, workspace_id, name, description,
                       release_manager_id, qa_lead_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const team of tenancy.seedTeams) {
    insertTeam.run(team.id, team.organizationId, team.workspaceId, team.name,
      team.description ?? null, team.releaseManagerId ?? null, team.qaLeadId ?? null,
      iso(team.createdAt))
  }

  const linkTeam = db.prepare(
    'INSERT OR IGNORE INTO member_team (member_id, team_id) VALUES (?, ?)',
  )
  for (const member of tenancy.seedMembers) {
    for (const teamId of member.teamIds) linkTeam.run(member.id, teamId)
  }

  const insertInvitation = db.prepare(
    `INSERT INTO invitation (id, organization_id, email, role_id, workspace_id, team_id,
                             status, token_hash, invited_by_id, invited_at, expires_at,
                             accepted_at, resent_at, resend_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const invite of tenancy.seedInvitations) {
    insertInvitation.run(invite.id, invite.organizationId, invite.email, invite.roleId,
      invite.workspaceId, invite.teamId ?? null, invite.status, `seed_${invite.id}`,
      invite.invitedById, iso(invite.invitedAt), iso(invite.expiresAt),
      iso(invite.acceptedAt), iso(invite.resentAt), invite.resendCount)
  }

  const insertIntegration = db.prepare(
    `INSERT INTO integration (id, workspace_id, type, name, enabled, config, last_sync_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const integration of delivery.seedIntegrations) {
    // Seed config is discarded: it held placeholder credentials, and a real one
    // is configured through the app.
    insertIntegration.run(integration.id, integration.workspaceId, integration.type,
      integration.name, bit(integration.enabled), '{}', iso(integration.lastSyncAt),
      iso(integration.createdAt))
  }

  const insertNotification = db.prepare(
    `INSERT INTO notification (id, member_id, workspace_id, type, level, title, message, link, read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const notification of delivery.seedNotifications) {
    insertNotification.run(notification.id, notification.userId, notification.workspaceId,
      notification.type, notification.level, notification.title, notification.message,
      notification.link ?? null, bit(notification.read), iso(notification.createdAt))
  }

  const insertAudit = db.prepare(
    `INSERT INTO audit_log (organization_id, workspace_id, actor_id, actor_name, actor_email,
                            actor_avatar, action, resource, resource_id, changes, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const entry of delivery.seedAuditLogs) {
    insertAudit.run(entry.organizationId, entry.workspaceId ?? null, entry.userId,
      entry.user.name, entry.user.email, entry.user.avatar ?? null, entry.action,
      entry.resource, entry.resourceId ?? null,
      entry.changes ? JSON.stringify(entry.changes) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null, iso(entry.createdAt))
  }

  // Delivery data belongs to the primary workspace until Jira sync assigns it.
  const ws1 = tenancy.seedWorkspaces[0].id

  const insertSprint = db.prepare(
    'INSERT INTO sprint (id, workspace_id, name, team, start_date, end_date, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
  for (const sprint of delivery.sprints) {
    insertSprint.run(sprint.id, ws1, sprint.name, sprint.team, iso(sprint.startDate),
      iso(sprint.endDate), JSON.stringify(sprint))
  }

  const insertRelease = db.prepare(
    'INSERT INTO release (id, workspace_id, name, version, target_date, payload) VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const release of delivery.releases) {
    insertRelease.run(release.id, ws1, release.name, release.version, iso(release.targetDate),
      JSON.stringify(release))
  }

  const insertQa = db.prepare(
    'INSERT INTO qa_item (id, workspace_id, issue_key, payload) VALUES (?, ?, ?, ?)',
  )
  for (const item of delivery.qaQueue) insertQa.run(item.id, ws1, item.issueKey, JSON.stringify(item))

  const insertTester = db.prepare(
    'INSERT INTO qa_tester (id, workspace_id, payload) VALUES (?, ?, ?)',
  )
  // A QA tester is identified by name in the fixture, so give it a stable id.
  delivery.qaTesters.forEach((tester, index) =>
    insertTester.run(`tester-${index + 1}`, ws1, JSON.stringify(tester)))

  const insertRule = db.prepare(
    `INSERT INTO rule (id, workspace_id, name, category, enabled, action, score_impact,
                       description, conditions, triggered_count, last_triggered)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  for (const rule of delivery.rules) {
    insertRule.run(rule.id, ws1, rule.name, rule.category, bit(rule.enabled), rule.action,
      rule.scoreImpact, rule.description, JSON.stringify(rule.conditions),
      rule.triggeredCount, iso(rule.lastTriggered))
  }

  const insertRisk = db.prepare(
    'INSERT INTO risk_event (id, workspace_id, occurred_at, payload) VALUES (?, ?, ?, ?)',
  )
  for (const event of delivery.riskTimeline) {
    insertRisk.run(event.id, ws1, iso(event.date), JSON.stringify(event))
  }

  const insertSignal = db.prepare(
    'INSERT INTO signal (id, workspace_id, kind, payload) VALUES (?, ?, ?, ?)',
  )
  for (const signal of delivery.signals) insertSignal.run(signal.id, ws1, 'signal', JSON.stringify(signal))
  for (const signal of delivery.liveSignals) insertSignal.run(signal.id, ws1, 'live', JSON.stringify(signal))

  const insertHealth = db.prepare(
    'INSERT INTO service_health (id, workspace_id, payload) VALUES (?, ?, ?)',
  )
  delivery.serviceHealth.forEach((service, index) =>
    insertHealth.run(`svc-${index + 1}`, ws1, JSON.stringify(service)))

  db.prepare(
    'INSERT INTO dashboard_metrics (workspace_id, payload, updated_at) VALUES (?, ?, ?)',
  ).run(ws1, JSON.stringify(delivery.dashboardMetrics), new Date().toISOString())

  db.prepare('INSERT INTO billing (workspace_id, payload) VALUES (?, ?)')
    .run(ws1, JSON.stringify(delivery.seedBilling))

  await db.exec('COMMIT')
  if (db.flush) await db.flush()
} catch (error) {
  await db.exec('ROLLBACK')
  throw error
}

const count = async (table) => db.count(table)
console.log(
  `${db.label} seeded — ${await count('member')} members, ${await count('team')} teams, ` +
  `${await count('rule')} rules, ${await count('notification')} notifications, ` +
  `${await count('audit_log')} audit records`,
)
console.log(`  admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}  (must be changed on first sign-in)`)

await db.close()
