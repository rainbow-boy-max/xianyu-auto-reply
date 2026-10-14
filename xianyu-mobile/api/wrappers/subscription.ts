/**
 * 会员订阅 / AI 钱包 / 支付密码（移动端 API 封装）
 *
 * 复用 web 端同一套后端接口：
 * - /api/v1/subscription/*   权益 / 套餐 / 订阅 / 购买
 * - /api/v1/wallet/*         AI 钱包 / 支付密码
 * - /api/v1/user-notifications 站内消息与弹窗
 */
import { getApiClient, extractError } from './client';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface Entitlements {
  user_id: number;
  is_admin: boolean;
  plan: {
    id: number;
    name: string;
    code: string;
    is_full: boolean;
    ai_discount: string;
    ai_free_text: number;
    ai_free_image: number;
    ai_free_grant_mode: string;
    allow_custom_text_model: boolean;
    allow_custom_image_model: boolean;
  } | null;
  subscription: {
    id: number;
    plan_id: number;
    start_at?: string;
    end_at?: string;
    status: string;
    source: string;
    days_left: number | null;
  } | null;
  features: Record<string, { enabled: boolean; quota: number | null }>;
  ai: {
    discount: string;
    free_text: number;
    free_image: number;
    grant_mode: string;
    allow_custom_text_model: boolean;
    allow_custom_image_model: boolean;
  };
}

export interface Plan {
  id: number;
  name: string;
  code: string;
  description: string;
  price_month: string;
  price_quarter: string;
  price_year: string;
  duration_days: number;
  is_default: boolean;
  is_full: boolean;
  enabled: boolean;
  ai_discount: string;
  ai_free_text: number;
  ai_free_image: number;
  allow_custom_text_model: boolean;
  features: { feature_key: string; enabled: boolean; quota: number | null }[];
}

export interface SubscriptionRecord {
  id: number;
  plan_name: string;
  plan_code: string;
  start_at?: string;
  end_at?: string;
  status: string;
  source: string;
  amount: string;
}

export interface AiWalletSnapshot {
  balance: string;
  total_recharge: string;
  total_consume: string;
  pay_password_set: boolean;
  pay_password_required: boolean;
}

export interface AiWalletFlow {
  id: number;
  type: string;
  amount: string;
  balance_after: string;
  feature_key?: string;
  description: string;
  created_at?: string;
}

/** 后端统一响应 { success, message, data }，解出 data */
function unwrap<T>(body: unknown): T | null {
  let cur: unknown = body;
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    const obj = cur as Record<string, unknown>;
    if (obj.data == null) break;
    const isEnvelope = 'success' in obj || 'code' in obj;
    if (!isEnvelope) break;
    cur = obj.data;
  }
  return (cur ?? null) as T | null;
}

// ---------------------------------------------------------------------------
// 权益 / 套餐
// ---------------------------------------------------------------------------

export async function getEntitlements(): Promise<Entitlements | null> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/subscription/entitlements')) as { data?: unknown };
    return unwrap<Entitlements>(data);
  } catch (e) {
    throw await extractError(e);
  }
}

export async function getPlans(): Promise<Plan[]> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/subscription/plans')) as { data?: unknown };
    const inner = unwrap<{ plans?: Plan[] }>(data);
    return inner?.plans ?? [];
  } catch (e) {
    throw await extractError(e);
  }
}

export async function getMySubscriptions(): Promise<SubscriptionRecord[]> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/subscription/my')) as { data?: unknown };
    const inner = unwrap<{ records?: SubscriptionRecord[] }>(data);
    return inner?.records ?? [];
  } catch (e) {
    throw await extractError(e);
  }
}

export async function purchasePlan(planCode: string, period: 'month' | 'quarter' | 'year' = 'month') {
  try {
    const client = await getApiClient();
    const { data } = (await (client.POST as any)('/api/v1/subscription/purchase', {
      body: { plan_code: planCode, period },
    })) as { data?: unknown };
    return unwrap<{ plan_name: string; end_at: string; amount: string; balance: string }>(data);
  } catch (e) {
    throw await extractError(e);
  }
}

// ---------------------------------------------------------------------------
// AI 钱包 / 支付密码
// ---------------------------------------------------------------------------

export async function getAiWallet(): Promise<AiWalletSnapshot | null> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/wallet/ai')) as { data?: unknown };
    return unwrap<AiWalletSnapshot>(data);
  } catch (e) {
    throw await extractError(e);
  }
}

export async function getAiWalletFlows(limit = 50): Promise<AiWalletFlow[]> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/wallet/ai/flows', {
      params: { query: { limit } },
    })) as { data?: unknown };
    const inner = unwrap<{ flows?: AiWalletFlow[] }>(data);
    return inner?.flows ?? [];
  } catch (e) {
    throw await extractError(e);
  }
}

export async function transferToAiWallet(amount: string, payPassword: string) {
  try {
    const client = await getApiClient();
    const { data } = (await (client.POST as any)('/api/v1/wallet/ai/transfer', {
      body: { amount, pay_password: payPassword },
    })) as { data?: unknown };
    return unwrap<{ balance: string; ai_balance: string }>(data);
  } catch (e) {
    throw await extractError(e);
  }
}

export async function setPayPassword(
  newPassword: string,
  oldPassword = '',
  verifyCode = '',
  channel = '',
): Promise<boolean> {
  try {
    const client = await getApiClient();
    await (client.POST as any)('/api/v1/wallet/pay-password/set', {
      body: { new_password: newPassword, old_password: oldPassword, verify_code: verifyCode, channel },
    });
    return true;
  } catch (e) {
    throw await extractError(e);
  }
}

/** 发送支付密码验证码（channel: sms/email）— [支付密码验证码 2026-10-14] */
export async function sendPayPasswordCode(channel: 'sms' | 'email'): Promise<boolean> {
  try {
    const client = await getApiClient();
    await (client.POST as any)('/api/v1/wallet/pay-password/send-code', {
      body: { channel },
    });
    return true;
  } catch (e) {
    throw await extractError(e);
  }
}

/** 忘记支付密码：验证码重置 */
export async function resetPayPassword(
  newPassword: string,
  verifyCode: string,
  channel: 'sms' | 'email',
): Promise<boolean> {
  try {
    const client = await getApiClient();
    await (client.POST as any)('/api/v1/wallet/pay-password/reset', {
      body: { new_password: newPassword, verify_code: verifyCode, channel },
    });
    return true;
  } catch (e) {
    throw await extractError(e);
  }
}

export async function updateWalletSettings(payPasswordRequired: boolean): Promise<boolean> {
  try {
    const client = await getApiClient();
    await (client.PUT as any)('/api/v1/wallet/settings', {
      body: { pay_password_required: payPasswordRequired },
    });
    return true;
  } catch (e) {
    throw await extractError(e);
  }
}

export async function getWalletPolicy(): Promise<{ transfer_limit: string; max_fails: number; lock_minutes: number } | null> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/wallet/policy')) as { data?: unknown };
    return unwrap<{ transfer_limit: string; max_fails: number; lock_minutes: number }>(data);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 站内消息 / 弹窗
// ---------------------------------------------------------------------------

export interface UserNotification {
  id: number;
  title: string;
  content: string;
  link: string;
  category: string;
  is_read: boolean;
  created_at?: string;
}

export async function getUserNotifications(limit = 50): Promise<{ notifications: UserNotification[]; unread: number }> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/user-notifications', {
      params: { query: { limit } },
    })) as { data?: unknown };
    const inner = unwrap<{ notifications?: UserNotification[]; unread?: number }>(data);
    return { notifications: inner?.notifications ?? [], unread: inner?.unread ?? 0 };
  } catch (e) {
    throw await extractError(e);
  }
}

export async function markNotificationsRead(notificationId?: number): Promise<boolean> {
  try {
    const client = await getApiClient();
    await (client.POST as any)('/api/v1/user-notifications/read', {
      body: { notification_id: notificationId ?? null },
    });
    return true;
  } catch (e) {
    throw await extractError(e);
  }
}

export async function getPendingPopup(): Promise<{ id: number; title: string; content: string; link: string } | null> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.GET as any)('/api/v1/user-notifications/popup')) as { data?: unknown };
    const inner = unwrap<{ popup?: { id: number; title: string; content: string; link: string } | null }>(data);
    return inner?.popup ?? null;
  } catch {
    return null;
  }
}

export async function dismissPopup(popupId: number): Promise<boolean> {
  try {
    const client = await getApiClient();
    await (client.POST as any)('/api/v1/user-notifications/popup/dismiss', {
      body: { popup_id: popupId },
    });
    return true;
  } catch {
    return false;
  }
}
