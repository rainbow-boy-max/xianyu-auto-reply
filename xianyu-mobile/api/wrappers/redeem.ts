/**
 * 卡密兑换（移动端 API 封装）
 *
 * 复用 web 端同一套后端接口：POST /api/v1/redeem
 */
import { getApiClient, extractError } from './client';

export interface RedeemResult {
  type: string;
  type_label: string;
  detail?: unknown;
}

/** 兑换卡密 */
export async function redeemCode(code: string): Promise<RedeemResult | null> {
  try {
    const client = await getApiClient();
    const { data } = (await (client.POST as any)('/api/v1/redeem', {
      body: { code },
    })) as { data?: any };
    if (data && data.success === false) {
      throw new Error(data.message || '兑换失败');
    }
    return (data?.data as RedeemResult) ?? null;
  } catch (e) {
    throw await extractError(e);
  }
}
