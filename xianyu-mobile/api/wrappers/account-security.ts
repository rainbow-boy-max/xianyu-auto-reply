/**
 * 账号安全与法律文书 API（APP 同步补丁 2026-10-13）
 *
 * - 双因素认证（2FA）：状态 / 开启 / 关闭 / 恢复码
 * - 法律文书：用户协议 / 隐私政策
 * - 账号权利：数据导出 / 账号注销
 */
import { getApiClient, extractError } from './client';

export interface ApiResult<T = unknown> {
  success: boolean;
  code?: number;
  message?: string | null;
  data?: T;
}

// ── 双因素认证 ────────────────────────────────────────────────────────────

export interface TwoFactorStatus {
  enabled: boolean;
  recovery_codes_remaining: number;
  confirmed_at?: string;
}

export interface TwoFactorSetup {
  secret: string;
  otpauth_uri: string;
  qr_data_uri: string;
  issuer: string;
}

/** 双因素认证状态 */
export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)('/api/v1/user/2fa/status')) as {
    data?: ApiResult<TwoFactorStatus>;
    error?: unknown;
  };
  if (error) throw await extractError(error);
  return (data?.data ?? { enabled: false, recovery_codes_remaining: 0 }) as TwoFactorStatus;
}

/** 生成密钥与二维码（待确认） */
export async function setupTwoFactor(): Promise<TwoFactorSetup> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/2fa/setup')) as {
    data?: ApiResult<TwoFactorSetup>;
    error?: unknown;
  };
  if (error) throw await extractError(error);
  if (!data?.success || !data.data) throw new Error(data?.message || '获取密钥失败');
  return data.data;
}

/** 校验动态码后开启，返回一次性恢复码 */
export async function enableTwoFactor(code: string): Promise<string[]> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/2fa/enable', {
    body: { code },
  })) as { data?: ApiResult<{ recovery_codes: string[] }>; error?: unknown };
  if (error) throw await extractError(error);
  if (!data?.success) throw new Error(data?.message || '开启失败');
  return data.data?.recovery_codes ?? [];
}

/** 关闭双因素认证（需登录密码 + 动态码或恢复码） */
export async function disableTwoFactor(loginPwd: string, code: string): Promise<void> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/2fa/disable', {
    body: { login_pwd: loginPwd, code },
  })) as { data?: ApiResult; error?: unknown };
  if (error) throw await extractError(error);
  if (!data?.success) throw new Error(data?.message || '关闭失败');
}

/** 用动态码重置恢复码 */
export async function regenerateRecoveryCodes(code: string): Promise<string[]> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/2fa/recovery-codes', {
    body: { code },
  })) as { data?: ApiResult<{ recovery_codes: string[] }>; error?: unknown };
  if (error) throw await extractError(error);
  if (!data?.success) throw new Error(data?.message || '重置失败');
  return data.data?.recovery_codes ?? [];
}

// ── 法律文书 ──────────────────────────────────────────────────────────────

export interface LegalDocument {
  title: string;
  content: string;
}

export interface LegalDocuments {
  terms: LegalDocument;
  privacy: LegalDocument;
  updated_at: string;
}

/** 获取用户协议与隐私政策（无需登录） */
export async function getLegalDocuments(): Promise<LegalDocuments> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)('/api/v1/legal/documents')) as {
    data?: ApiResult<LegalDocuments>;
    error?: unknown;
  };
  if (error) throw await extractError(error);
  return (data?.data ?? {
    terms: { title: '用户协议', content: '' },
    privacy: { title: '隐私政策', content: '' },
    updated_at: '',
  }) as LegalDocuments;
}

// ── 账号权利 ──────────────────────────────────────────────────────────────

/** 导出本人数据（不含凭据） */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)('/api/v1/user/account/export')) as {
    data?: ApiResult<Record<string, unknown>>;
    error?: unknown;
  };
  if (error) throw await extractError(error);
  if (!data?.success) throw new Error(data?.message || '导出失败');
  return (data.data ?? {}) as Record<string, unknown>;
}

/** 注销账号（软删除 + 匿名化） */
export async function deleteMyAccount(password: string, confirmText: string): Promise<void> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/account/delete', {
    body: { password, confirm_text: confirmText },
  })) as { data?: ApiResult; error?: unknown };
  if (error) throw await extractError(error);
  if (!data?.success) throw new Error(data?.message || '注销失败');
}
