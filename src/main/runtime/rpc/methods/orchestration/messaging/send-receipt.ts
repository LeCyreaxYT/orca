import type { SendRecipientWarning } from './recipient-routing'

export type SendReceipt = <T extends object>(
  receipt: T
) => T & { warnings?: SendRecipientWarning[] }

export function createSendReceipt(warnings: SendRecipientWarning[]): SendReceipt {
  return <T extends object>(receipt: T): T & { warnings?: SendRecipientWarning[] } =>
    warnings.length > 0 ? { ...receipt, warnings } : receipt
}
