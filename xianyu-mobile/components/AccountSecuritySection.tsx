/**
 * 账号安全区块（APP 同步补丁 2026-10-13）
 *
 * 包含：
 * 1. 双因素认证（2FA）：扫码开启 / 一次性恢复码 / 重置 / 关闭
 * 2. 数据导出：导出本人数据（JSON，不含凭据）
 * 3. 账号注销：密码 + 二次确认 → 软删除 + 匿名化
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  Pressable,
  useColorScheme,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { ShieldCheck, ShieldOff, Download, Trash2, RefreshCw } from 'lucide-react-native';
import { Button, Input, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/lib/theme';
import {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
  exportMyData,
  deleteMyAccount,
} from '@/api/wrappers/account-security';

interface Props {
  /** 注销成功后回调（用于清除登录态并跳转） */
  onDeleted?: () => void;
}

export function AccountSecuritySection({ onDeleted }: Props) {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];

  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);

  // 开启流程
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQr, setSetupQr] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // 关闭流程
  const [disablePwd, setDisablePwd] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');

  // 注销流程
  const [delPwd, setDelPwd] = useState('');
  const [delConfirm, setDelConfirm] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const st = await getTwoFactorStatus();
      setEnabled(!!st.enabled);
      setRemaining(st.recovery_codes_remaining || 0);
    } catch {
      // 忽略：未登录或网络异常时保持默认
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSetup() {
    try {
      setBusy(true);
      const data = await setupTwoFactor();
      setSetupSecret(data.secret);
      setSetupQr(data.qr_data_uri);
      setSetupCode('');
    } catch (e) {
      Alert.alert('获取密钥失败', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEnable() {
    if (!setupCode.trim()) {
      Alert.alert('提示', '请输入动态验证码');
      return;
    }
    try {
      setBusy(true);
      const codes = await enableTwoFactor(setupCode.trim());
      setRecoveryCodes(codes);
      setSetupSecret('');
      setSetupQr('');
      setSetupCode('');
      Alert.alert('已开启', '双因素认证已开启，请妥善保存恢复码');
      await load();
    } catch (e) {
      Alert.alert('开启失败', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!disablePwd || !disableCode.trim()) {
      Alert.alert('提示', '请输入登录密码与动态码/恢复码');
      return;
    }
    try {
      setBusy(true);
      await disableTwoFactor(disablePwd, disableCode.trim());
      setDisablePwd('');
      setDisableCode('');
      setRecoveryCodes([]);
      Alert.alert('已关闭', '双因素认证已关闭');
      await load();
    } catch (e) {
      Alert.alert('关闭失败', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegen() {
    if (!regenCode.trim()) {
      Alert.alert('提示', '请输入当前动态验证码');
      return;
    }
    try {
      setBusy(true);
      const codes = await regenerateRecoveryCodes(regenCode.trim());
      setRecoveryCodes(codes);
      setRegenCode('');
      Alert.alert('已重置', '新的恢复码已生成，旧恢复码全部失效');
      await load();
    } catch (e) {
      Alert.alert('重置失败', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    try {
      setBusy(true);
      const data = await exportMyData();
      const json = JSON.stringify(data, null, 2);
      // 优先保存为文件并分享；不可用时回退到复制到剪贴板
      try {
        const fileUri = `${FileSystem.cacheDirectory}my-data-${Date.now()}.json`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: '导出我的数据',
          });
          return;
        }
        Alert.alert('已导出', `文件已保存：${fileUri}`);
      } catch {
        await Clipboard.setStringAsync(json);
        Alert.alert('已导出', '数据已复制到剪贴板（JSON 格式）');
      }
    } catch (e) {
      Alert.alert('导出失败', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!delPwd) {
      Alert.alert('提示', '请输入登录密码');
      return;
    }
    if (delConfirm.trim() !== '注销账号') {
      Alert.alert('提示', '请输入「注销账号」以确认');
      return;
    }
    Alert.alert(
      '确认注销',
      '注销后账号将无法登录，个人信息会被删除或匿名化，且不可恢复。确定继续吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认注销',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              await deleteMyAccount(delPwd, delConfirm.trim());
              setDelPwd('');
              setDelConfirm('');
              Alert.alert('已注销', '账号已注销，感谢您的使用', [
                { text: '确定', onPress: () => onDeleted?.() },
              ]);
            } catch (e) {
              Alert.alert('注销失败', (e as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <>
      {/* 双因素认证 */}
      <Card style={styles.section}>
        <View style={styles.titleRow}>
          {enabled ? (
            <ShieldCheck size={16} stroke={c.success} />
          ) : (
            <ShieldOff size={16} stroke={c.textSecondary} />
          )}
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
            双因素认证（2FA）
          </Text>
        </View>
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          开启后登录需额外输入身份验证器 App 中的动态码，可显著提升账号安全。
          {enabled ? ` 当前剩余恢复码 ${remaining} 个。` : ''}
        </Text>

        {!loading && !enabled && !setupQr && (
          <Button
            label="开启双因素认证"
            onPress={handleSetup}
            loading={busy}
            style={styles.btn}
          />
        )}

        {!enabled && setupQr ? (
          <>
            <Text style={[styles.hint, { color: c.textSecondary }]}>
              1. 用身份验证器 App 扫描二维码（或手动输入下方密钥）
            </Text>
            <Image source={{ uri: setupQr }} style={styles.qr} resizeMode="contain" />
            <Text style={[styles.secret, { color: c.text }]} selectable>
              {setupSecret}
            </Text>
            <Text style={[styles.hint, { color: c.textSecondary }]}>
              2. 输入 App 中显示的 6 位动态码完成绑定
            </Text>
            <Input
              value={setupCode}
              onChangeText={setSetupCode}
              placeholder="6 位动态验证码"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Button label="确认开启" onPress={handleEnable} loading={busy} style={styles.btn} />
          </>
        ) : null}

        {recoveryCodes.length > 0 && (
          <View style={[styles.recoveryBox, { borderColor: c.warning }]}>
            <Text style={[styles.recoveryTitle, { color: c.warning }]}>
              请立即保存以下恢复码（仅展示一次），手机丢失时可用它登录：
            </Text>
            <Text style={[styles.recoveryCodes, { color: c.text }]} selectable>
              {recoveryCodes.join('\n')}
            </Text>
          </View>
        )}

        {enabled && (
          <>
            <Input
              value={regenCode}
              onChangeText={setRegenCode}
              placeholder="输入当前动态码以重置恢复码"
              keyboardType="number-pad"
              style={styles.input}
            />
            <Button
              label="重置恢复码"
              variant="secondary"
              onPress={handleRegen}
              loading={busy}
              style={styles.btn}
            />
            <Text style={[styles.hint, { color: c.textSecondary, marginTop: spacing.sm }]}>
              关闭双因素认证（需登录密码 + 动态码或恢复码）
            </Text>
            <Input
              value={disablePwd}
              onChangeText={setDisablePwd}
              placeholder="登录密码"
              secureTextEntry
              style={styles.input}
            />
            <Input
              value={disableCode}
              onChangeText={setDisableCode}
              placeholder="动态码或恢复码"
              autoCapitalize="characters"
              style={styles.input}
            />
            <Button
              label="关闭双因素认证"
              variant="danger"
              onPress={handleDisable}
              loading={busy}
              style={styles.btn}
            />
          </>
        )}
      </Card>

      {/* 数据导出 */}
      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Download size={16} stroke={c.textSecondary} />
          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>导出我的数据</Text>
        </View>
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          导出您的账号资料、会员订阅、钱包、AI 用量、账号与收货地址等数据（JSON，不含任何密码或凭据）。
        </Text>
        <Button
          label="导出我的数据"
          variant="secondary"
          onPress={handleExport}
          loading={busy}
          style={styles.btn}
        />
      </Card>

      {/* 账号注销 */}
      <Card style={[styles.section, { borderColor: c.error }]}>
        <View style={styles.titleRow}>
          <Trash2 size={16} stroke={c.error} />
          <Text style={[styles.sectionTitle, { color: c.error }]}>注销账号</Text>
        </View>
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          注销后账号将无法登录，个人信息会被删除或匿名化处理，且不可恢复。请谨慎操作。
        </Text>
        <Input
          value={delPwd}
          onChangeText={setDelPwd}
          placeholder="登录密码"
          secureTextEntry
          style={styles.input}
        />
        <Input
          value={delConfirm}
          onChangeText={setDelConfirm}
          placeholder="请输入：注销账号"
          style={styles.input}
        />
        <Button
          label="申请注销账号"
          variant="danger"
          onPress={confirmDelete}
          loading={busy}
          style={styles.btn}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.caption, fontWeight: '600' },
  hint: { ...typography.caption, lineHeight: 20 },
  input: { marginTop: spacing.xs },
  btn: { marginTop: spacing.sm },
  qr: { width: 180, height: 180, alignSelf: 'center', marginVertical: spacing.sm },
  secret: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    letterSpacing: 1,
  },
  recoveryBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  recoveryTitle: { ...typography.caption, lineHeight: 20 },
  recoveryCodes: { ...typography.body, lineHeight: 24, letterSpacing: 1 },
});
