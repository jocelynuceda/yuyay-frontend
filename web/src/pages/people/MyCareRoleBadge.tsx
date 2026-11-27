import { Badge } from '../../components/ui/Badge'
import type { CareRole } from '../../types'

export function MyCareRoleBadge({ role }: { role: CareRole }) {
  return <Badge tone="primary">{role === 'PRINCIPAL' ? 'Tú coordinas el cuidado' : 'Tú colaboras en el cuidado'}</Badge>
}
