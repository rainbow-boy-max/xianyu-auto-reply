import { getApiClient, extractError } from './client';

/**
 * 手机号 / 实人认证（对齐 web phoneAuth.ts）
 * 后端路由前缀: /api/v1/user
 */

export interface PhoneStatus {
  phone_masked?: string | null;
  real_name_verified?: boolean;
  real_name_masked?: string | null;
  real_name_verified_at?: string | null;
  require_real_name?: boolean;
  change_interval_days?: number | null;
  [k: string]: unknown;
}

/** 手机号与实人认证状态（脱敏） */
export async function getPhoneStatus(): Promise<PhoneStatus> {
  const client = await getApiClient();
  const { data, error } = (await (client.GET as any)('/api/v1/user/phone')) as {
    data?: PhoneStatus;
    error?: unknown;
  };
  if (error) throw await extractError(error);
  // 后端返回 { success, code, message, data:{...} }，需取内层 data
  const body = data as ({ data?: PhoneStatus } & PhoneStatus) | undefined;
  return ((body && body.data) ? body.data : body) ?? ({} as PhoneStatus);
}

export interface RealNameResult {
  success: boolean;
  message?: string;
  data?: { real_name_masked?: string; id_card_masked?: string } | null;
}

/**
 * 独立实人认证（手机号 + 姓名 + 证件号三要素）。
 * 注意：后端即使失败也返回 HTTP 200 + {success:false, message}，故此处返回体由调用方判 success。
 */
export async function verifyRealName(
  realName: string,
  idCard: string,
  phone: string,
): Promise<RealNameResult> {
  const client = await getApiClient();
  const { data, error } = (await (client.POST as any)('/api/v1/user/real-name/verify', {
    body: { real_name: realName, id_card: idCard, phone },
  })) as { data?: RealNameResult; error?: unknown };
  if (error) throw await extractError(error);
  return (data ?? { success: false, message: '认证失败' }) as RealNameResult;
}
