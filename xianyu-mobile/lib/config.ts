import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const PROFILES_KEY = 'server_profiles';
const ACTIVE_KEY = 'active_profile_index';
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// [APP 登录修复 2026-10-14] 默认服务器地址（HTTPS 域名）
export const DEFAULT_SERVER_URL = 'https://xy.miaotuntu.com';

/**
 * 迁移历史服务器地址：早期版本默认填过 IP:8089，但服务端口已收敛（仅本机监听），
 * 外网必须经 HTTPS 域名访问。此处自动把指向该 IP/8089 的配置改回官方域名。
 */
export async function migrateLegacyServerUrl(): Promise<void> {
  try {
    const profiles = await getServerProfiles();
    if (!profiles.length) return;
    let changed = false;
    const next = profiles.map((p) => {
      const u = (p.url || '').trim();
      if (/:8089(\/|$)/.test(u) || u.includes('155.103.157.160')) {
        changed = true;
        return { ...p, url: DEFAULT_SERVER_URL };
      }
      return p;
    });
    if (changed) {
      await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    }
  } catch {
    // 迁移失败不影响启动
  }
}

export interface ServerProfile {
  name: string;
  url: string;
}

export async function getServerProfiles(): Promise<ServerProfile[]> {
  const raw = await AsyncStorage.getItem(PROFILES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addServerProfile(profile: ServerProfile): Promise<void> {
  const profiles = await getServerProfiles();
  profiles.push(profile);
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  // 自动激活新添加的 profile
  await setActiveProfileIndex(profiles.length - 1);
}

export async function getActiveProfileIndex(): Promise<number> {
  const raw = await AsyncStorage.getItem(ACTIVE_KEY);
  return raw ? parseInt(raw, 10) : -1;
}

export async function setActiveProfileIndex(index: number): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, String(index));
}

export async function getServerUrl(): Promise<string | null> {
  const index = await getActiveProfileIndex();
  if (index < 0) return null;
  const profiles = await getServerProfiles();
  return profiles[index]?.url ?? null;
}

// 内存缓存：避免每个 API 请求都读 SecureStore（原生模块调用开销大）
let cachedToken: string | null | undefined; // undefined = 未加载
let cachedRefreshToken: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken !== undefined) return cachedRefreshToken;
  cachedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  return cachedRefreshToken;
}

export async function setRefreshToken(token: string): Promise<void> {
  cachedRefreshToken = token;
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearTokens(): Promise<void> {
  cachedToken = null;
  cachedRefreshToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
