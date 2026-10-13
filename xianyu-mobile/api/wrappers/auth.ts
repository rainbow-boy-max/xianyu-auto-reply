import { getApiClient, extractError } from './client';
import type { AuthUser } from '@/stores/auth';

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string | null;
  refresh_token?: string | null;
  user_id?: number | null;
  username?: string | null;
  is_admin?: boolean | null;
  account_limit?: number | null;
  // [APP 同步补丁 2026-10-13] 已开启双因素认证时返回
  need_2fa?: boolean | null;
  twofa_token?: string | null;
}

interface VerifyResponse {
  authenticated: boolean;
  user_id?: number;
  username?: string;
  is_admin?: boolean;
  account_limit?: number | null;
}

export async function login(
  username: string,
  password: string,
  geetestChallenge?: string,
): Promise<LoginResponse> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/login', {
    body: { username, password, geetest_challenge: geetestChallenge },
  })) as { data?: LoginResponse; error?: unknown };

  if (error) throw await extractError(error);
  return data as LoginResponse;
}

export async function verifyToken(): Promise<VerifyResponse> {
  const client = await getApiClient();
  const { data } = (await (client.GET as any)('/api/v1/auth/verify')) as {
    data?: VerifyResponse;
    error?: unknown;
  };
  return data as VerifyResponse;
}

export async function logout(): Promise<void> {
  const client = await getApiClient();
  await (client.POST as any)('/api/v1/auth/logout');
}

/** 将 LoginResponse 的平铺字段转为 AuthUser */
export function extractUser(resp: LoginResponse): AuthUser | null {
  if (resp.user_id == null || resp.username == null) return null;
  return {
    user_id: resp.user_id,
    username: resp.username,
    is_admin: resp.is_admin ?? false,
    account_limit: resp.account_limit ?? null,
  };
}

/** 邮箱 + 密码登录（若后端开启极验，需传入 geetestChallenge） */
export async function loginWithEmail(
  email: string,
  password: string,
  geetestChallenge?: string,
): Promise<LoginResponse> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/login', {
    body: { email, password, geetest_challenge: geetestChallenge },
  })) as { data?: LoginResponse; error?: unknown };

  if (error) throw await extractError(error);
  return data as LoginResponse;
}

/** 邮箱 + 验证码登录（emailSessionId 由 sendEmailCode 返回） */
export async function loginWithVerificationCode(
  email: string,
  verificationCode: string,
  emailSessionId: string,
): Promise<LoginResponse> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/login', {
    body: {
      email,
      verification_code: verificationCode,
      email_session_id: emailSessionId,
    },
  })) as { data?: LoginResponse; error?: unknown };

  if (error) throw await extractError(error);
  return data as LoginResponse;
}

/** 注册 */
export async function register(
  username: string,
  email: string,
  password: string,
  verificationCode: string,
  sessionId: string,
): Promise<{ success: boolean; message?: string }> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/register', {
    body: {
      username,
      email,
      password,
      verification_code: verificationCode,
      session_id: sessionId,
    },
  })) as { data?: { success: boolean; message?: string }; error?: unknown };

  if (error) throw await extractError(error);
  return data as { success: boolean; message?: string };
}

/** 发送邮箱验证码，返回 session_id（register/login/reset_password 通用） */
export async function sendEmailCode(
  email: string,
  type: 'register' | 'login' | 'reset_password',
): Promise<{ session_id: string; success: boolean }> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)(
    '/api/v1/captcha/send-email-code',
    {
      body: { email, type },
    },
  )) as { data?: { session_id: string; success: boolean }; error?: unknown };

  if (error) throw await extractError(error);
  return data as { session_id: string; success: boolean };
}

/** 重置密码 */
export async function resetPassword(
  email: string,
  verificationCode: string,
  newPassword: string,
): Promise<{ success: boolean; message?: string }> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)(
    '/api/v1/auth/reset-password',
    {
      body: {
        email,
        verification_code: verificationCode,
        new_password: newPassword,
      },
    },
  )) as { data?: { success: boolean; message?: string }; error?: unknown };

  if (error) throw await extractError(error);
  return data as { success: boolean; message?: string };
}

/**
 * 获取极验滑块配置（challenge / gt / new_captcha / offline）。
 *
 * 后端返回两层信封结构：{ success, code, message, data: { success, gt, challenge, new_captcha } }。
 * 此前实现直接读取外层，导致 gt/challenge 恒为 undefined、SDK 卡在“加载验证码”。
 * 这里统一解包到内层 data，并做参数完整性校验（缺参数立即抛错，避免静默卡死）。
 * 内层 success === 0 表示极验宕机降级模式（离线本地验证）。
 */
export async function getGeetestConfig(): Promise<{
  challenge: string;
  gt: string;
  new_captcha: boolean;
  offline: boolean;
}> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)(
    '/api/v1/geetest/register',
  )) as {
    data?: {
      data?: {
        success?: number;
        gt?: string;
        challenge?: string;
        new_captcha?: boolean;
      };
      gt?: string;
      challenge?: string;
      new_captcha?: boolean;
    };
    error?: unknown;
  };

  if (error) throw await extractError(error);

  // 解包信封：优先取内层 data；若内层缺少 gt/challenge 则回退外层（兼容未来结构调整）
  const envelope = (data ?? {}) as Record<string, any>;
  const inner =
    envelope.data && (envelope.data.gt || envelope.data.challenge)
      ? envelope.data
      : envelope;

  const gt = inner.gt as string | undefined;
  const challenge = inner.challenge as string | undefined;
  if (!gt || !challenge) {
    throw new Error('验证码参数不完整，请重试');
  }

  return {
    gt,
    challenge,
    new_captcha: inner.new_captcha !== false,
    offline: inner.success === 0,
  };
}

/** 校验极验滑动结果 */
export async function validateGeetest(
  challenge: string,
  validate: string,
  seccode: string,
): Promise<void> {
  const client = await getApiClient();
  const { error } = (await (client.POST as any)('/api/v1/geetest/validate', {
    body: { challenge, validate, seccode },
  })) as { error?: unknown };

  if (error) throw await extractError(error);
}

/** 获取公共系统设置（login_captcha_enabled / registration_enabled 等） */
export async function getPublicSettings(): Promise<Record<string, unknown>> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)(
    '/api/v1/system-settings/public',
  )) as { data?: Record<string, unknown>; error?: unknown };

  if (error) throw await extractError(error);
  return (data ?? {}) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// [APP 同步补丁 2026-10-13] 密码策略 / 手机号短信 / 完整注册 / 双因素登录
// ─────────────────────────────────────────────────────────────────────────────

/** 密码强度策略（等保 2.0，后台可配） */
export interface PasswordPolicy {
  min_length: number;
  require_upper: boolean;
  require_lower: boolean;
  require_digit: boolean;
  require_special: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  min_length: 8,
  require_upper: true,
  require_lower: true,
  require_digit: true,
  require_special: true,
};

/** 与后端一致的待殊字符集 */
export const PASSWORD_SPECIAL_CHARS = "!@#$%^&*()-_=+[]{};:'\",.<>/?\\|`~";

export interface PasswordCheck {
  ok: boolean;
  checks: Record<string, boolean>;
  required: string[];
  missing: string[];
  message: string;
}

/** 本地按策略校验密码（与后端逻辑一致，用于实时提示） */
export function checkPassword(password: string, policy: PasswordPolicy): PasswordCheck {
  const pwd = password || '';
  const chars = Array.from(pwd);
  const checks: Record<string, boolean> = {
    length: pwd.length >= (policy.min_length || 8),
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    digit: /[0-9]/.test(pwd),
    special: chars.some((ch) => PASSWORD_SPECIAL_CHARS.includes(ch)),
  };
  const required = ['length'];
  if (policy.require_upper) required.push('upper');
  if (policy.require_lower) required.push('lower');
  if (policy.require_digit) required.push('digit');
  if (policy.require_special) required.push('special');
  const missing = required.filter((k) => !checks[k]);
  const label: Record<string, string> = {
    length: `长度至少 ${policy.min_length || 8} 位`,
    upper: '包含大写字母',
    lower: '包含小写字母',
    digit: '包含数字',
    special: '包含特殊字符',
  };
  return {
    ok: missing.length === 0,
    checks,
    required,
    missing,
    message: missing.length ? `密码还需：${missing.map((k) => label[k]).join('、')}` : '密码强度符合要求',
  };
}

/** 获取密码强度策略（公开接口） */
export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)(
    '/api/v1/auth/password-policy',
  )) as { data?: { data?: { policy?: PasswordPolicy } }; error?: unknown };
  if (error) throw await extractError(error);
  const policy = (data as any)?.data?.policy;
  return policy ?? DEFAULT_PASSWORD_POLICY;
}

/** 发送短信验证码（需先过极验，scene: register/login/reset_password） */
export async function sendSmsCode(
  target: string,
  scene: 'register' | 'login' | 'reset_password' | 'bind_phone' | 'change_phone',
  geetestChallenge: string,
): Promise<{ success: boolean; message?: string }> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/sms-code', {
    body: { target, scene, geetest_challenge: geetestChallenge },
  })) as { data?: { success: boolean; message?: string }; error?: unknown };
  if (error) throw await extractError(error);
  return (data ?? { success: false }) as { success: boolean; message?: string };
}

/** 发送邮箱验证码（需先过极验，scene: register/login/reset_password） */
export async function sendEmailCodeWithGeetest(
  target: string,
  scene: 'register' | 'login' | 'reset_password',
  geetestChallenge: string,
): Promise<{ success: boolean; message?: string }> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/email-code', {
    body: { target, scene, geetest_challenge: geetestChallenge },
  })) as { data?: { success: boolean; message?: string }; error?: unknown };
  if (error) throw await extractError(error);
  return (data ?? { success: false }) as { success: boolean; message?: string };
}

/** 完整注册：用户名 + 邮箱验证码 + 手机号短信验证码 + 密码 */
export async function registerFull(payload: {
  username: string;
  email: string;
  email_code: string;
  phone: string;
  sms_code: string;
  password: string;
}): Promise<{ success: boolean; message?: string }> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/register-full', {
    body: payload,
  })) as { data?: { success: boolean; message?: string }; error?: unknown };
  if (error) throw await extractError(error);
  return (data ?? { success: false }) as { success: boolean; message?: string };
}

/** 手机号登录（验证码或密码） */
export async function loginByPhone(payload: {
  phone: string;
  code?: string;
  password?: string;
  totp_code?: string;
  twofa_token?: string;
}): Promise<LoginResponse> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/auth/login-phone', {
    body: payload,
  })) as { data?: LoginResponse; error?: unknown };
  if (error) throw await extractError(error);
  return data as LoginResponse;
}

/** 双因素登录第二步：用临时令牌 + 动态码/恢复码换取正式登录态 */
export async function twoFactorLogin(
  twofaToken: string,
  code: string,
): Promise<LoginResponse> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/2fa/login', {
    body: { twofa_token: twofaToken, code },
  })) as { data?: LoginResponse; error?: unknown };
  if (error) throw await extractError(error);
  return data as LoginResponse;
}
