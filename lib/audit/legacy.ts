import type { AuditAction, AuditResource } from '@/lib/types'

/**
 * Legacy `action`/`resource` for an event id.
 *
 * Those two columns are NOT NULL and older readers still use them, so every
 * write keeps them populated. The event id is the source of truth; this is a
 * projection of it, not a second opinion.
 */
export function legacyShape(event: string): { action: AuditAction; resource: AuditResource } {
  const [resourcePart, actionPart = ''] = event.split('.')

  const resource: AuditResource =
    resourcePart === 'member' ? 'member'
    : resourcePart === 'team' ? 'team'
    : resourcePart === 'workspace' ? 'workspace'
    : resourcePart === 'rule' ? 'rule'
    : resourcePart === 'integration' || resourcePart === 'notification' ? 'integration'
    : resourcePart === 'authz' ? 'role'
    : resourcePart === 'organization' || resourcePart === 'billing' ? 'organization'
    : 'config'

  const action: AuditAction =
    actionPart.startsWith('creat') ? 'create'
    : actionPart.startsWith('delet') || actionPart.startsWith('remov') ? 'delete'
    : actionPart.startsWith('invit') ? 'invite'
    : actionPart.startsWith('approv') ? 'approve'
    : actionPart.startsWith('reject') ? 'reject'
    : actionPart.startsWith('suspend') ? 'suspend'
    : actionPart.startsWith('activat') ? 'activate'
    : actionPart.includes('role') || actionPart.includes('permission') ? 'permission_change'
    : actionPart.startsWith('export') ? 'export'
    : 'update'

  return { action, resource }
}
