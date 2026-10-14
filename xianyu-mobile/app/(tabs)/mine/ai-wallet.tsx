import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { Coins, KeyRound, ArrowRightLeft, ShieldCheck } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '@/lib/theme';
import {
  getAiWallet,
  getAiWalletFlows,
  transferToAiWallet,
  setPayPassword,
  sendPayPasswordCode,
  resetPayPassword,
  updateWalletSettings,
  getWalletPolicy,
  type AiWalletSnapshot,
  type AiWalletFlow,
} from '@/api/wrappers/subscription';
import { logger } from '@/lib/logger';

const FLOW_LABEL: Record<string, string> = {
  recharge: '充值',
  consume: 'AI 消耗',
  transfer_in: '账户划入',
  admin_adjust: '管理员调整',
  refund: '退款',
};

export default function AiWalletScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];

  const [snap, setSnap] = useState<AiWalletSnapshot | null>(null);
  const [flows, setFlows] = useState<AiWalletFlow[]>([]);
  const [policy, setPolicy] = useState<{ transfer_limit: string; max_fails: number; lock_minutes: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [oldPwd, setOldPwd] = useState('');
  const [busy, setBusy] = useState(false);
  // [支付密码验证码 2026-10-14] 首次设置/忘记密码需验证码
  const [pwdMode, setPwdMode] = useState<'set' | 'change' | 'reset'>('set');
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [code, setCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const load = useCallback(async () => {
    try {
      const [w, f, p] = await Promise.all([getAiWallet(), getAiWalletFlows(50), getWalletPolicy()]);
      setSnap(w);
      setFlows(f);
      setPolicy(p);
    } catch (err) {
      logger.error('AiWallet', '加载失败', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 根据是否已设置支付密码初始化模式
  useEffect(() => {
    if (snap) setPwdMode(snap.pay_password_set ? 'change' : 'set');
  }, [snap]);

  const handleTransfer = async () => {
    if (!amount || !password) {
      Alert.alert('提示', '请填写划款金额与支付密码');
      return;
    }
    setBusy(true);
    try {
      const res = await transferToAiWallet(amount, password);
      Alert.alert('成功', res ? `AI 钱包余额 ¥${res.ai_balance}` : '划款成功');
      setAmount('');
      setPassword('');
      await load();
    } catch (err: any) {
      Alert.alert('失败', err?.message || '划款失败');
    } finally {
      setBusy(false);
    }
  };

  const handleSavePassword = async () => {
    if (!/^\d{6}$/.test(newPwd)) {
      Alert.alert('提示', '支付密码必须为 6 位数字');
      return;
    }
    if (pwdMode === 'change' && !/^\d{6}$/.test(oldPwd)) {
      Alert.alert('提示', '请输入原支付密码');
      return;
    }
    if (pwdMode !== 'change' && !code.trim()) {
      Alert.alert('提示', '请先获取并填写验证码');
      return;
    }
    setBusy(true);
    try {
      if (pwdMode === 'change') {
        await setPayPassword(newPwd, oldPwd);
      } else if (pwdMode === 'reset') {
        await resetPayPassword(newPwd, code.trim(), channel);
      } else {
        await setPayPassword(newPwd, '', code.trim(), channel);
      }
      Alert.alert('成功', pwdMode === 'reset' ? '支付密码已重置' : '支付密码已设置');
      setNewPwd('');
      setOldPwd('');
      setCode('');
      await load();
    } catch (err: any) {
      Alert.alert('失败', err?.message || '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = async () => {
    try {
      setSendingCode(true);
      await sendPayPasswordCode(channel);
      Alert.alert('已发送', '验证码已发送，请查收');
      setCountdown(60);
    } catch (err: any) {
      Alert.alert('发送失败', err?.message || '请稍后重试');
    } finally {
      setSendingCode(false);
    }
  };

  const toggleRequired = async (value: boolean) => {
    try {
      await updateWalletSettings(value);
      await load();
    } catch (err: any) {
      Alert.alert('失败', err?.message || '保存失败');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* 余额 */}
        <View style={[styles.hero, { backgroundColor: '#10b981' }]}>
          <View style={styles.row}>
            <Coins size={22} color="#fff" />
            <Text style={styles.heroLabel}>AI 钱包余额</Text>
          </View>
          <Text style={styles.heroBalance}>¥{snap?.balance ?? '0.0000'}</Text>
          <Text style={styles.heroSub}>
            累计充值 ¥{snap?.total_recharge ?? '0.0000'} · 累计消耗 ¥{snap?.total_consume ?? '0.0000'}
          </Text>
          <Text style={styles.heroWarn}>AI 钱包余额仅用于 AI 消费，不可提现、不可转回账户余额</Text>
        </View>

        {/* 划款 */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <ArrowRightLeft size={16} color={c.primary} />
            <Text style={[styles.cardTitle, { color: c.text, marginLeft: 6 }]}>从账户余额划入</Text>
          </View>
          {!snap?.pay_password_set && (
            <Text style={[styles.warn, { color: '#f59e0b' }]}>划款前请先设置支付密码</Text>
          )}
          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border }]}
            placeholder={`划款金额（单笔上限 ¥${policy?.transfer_limit || '10000'}）`}
            placeholderTextColor={c.textMuted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border }]}
            placeholder="支付密码（6 位数字）"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={password}
            onChangeText={(t) => setPassword(t.replace(/\D/g, ''))}
          />
          <Pressable style={[styles.btn, { backgroundColor: '#10b981', opacity: busy ? 0.6 : 1 }]} onPress={handleTransfer} disabled={busy}>
            <Text style={styles.btnText}>{busy ? '处理中...' : '确认划入'}</Text>
          </Pressable>
        </View>

        {/* 支付密码 */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={styles.row}>
            <KeyRound size={16} color={c.primary} />
            <Text style={[styles.cardTitle, { color: c.text, marginLeft: 6 }]}>支付密码</Text>
          </View>

          {snap?.pay_password_set && (
            <View style={[styles.row, { marginTop: 6 }]}>
              <Pressable onPress={() => { setPwdMode('change'); setCode(''); }} style={{ marginRight: 16 }}>
                <Text style={{ color: pwdMode === 'change' ? c.primary : c.textMuted, fontSize: typography.xs }}>
                  修改支付密码
                </Text>
              </Pressable>
              <Pressable onPress={() => { setPwdMode('reset'); setOldPwd(''); }}>
                <Text style={{ color: pwdMode === 'reset' ? c.primary : c.textMuted, fontSize: typography.xs }}>
                  忘记支付密码
                </Text>
              </Pressable>
            </View>
          )}

          {!snap?.pay_password_set && (
            <Text style={[styles.warn, { color: '#f59e0b', marginTop: 6 }]}>
              首次设置需先通过手机短信或邮箱验证码验证身份
            </Text>
          )}

          {pwdMode === 'change' && (
            <TextInput
              style={[styles.input, { color: c.text, borderColor: c.border }]}
              placeholder="原支付密码"
              placeholderTextColor={c.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={oldPwd}
              onChangeText={(t) => setOldPwd(t.replace(/\D/g, ''))}
            />
          )}

          {pwdMode !== 'change' && (
            <>
              <View style={[styles.row, { marginTop: 6 }]}>
                <Pressable onPress={() => setChannel('sms')} style={{ marginRight: 16 }}>
                  <Text style={{ color: channel === 'sms' ? c.primary : c.textMuted, fontSize: typography.xs }}>
                    手机短信
                  </Text>
                </Pressable>
                <Pressable onPress={() => setChannel('email')}>
                  <Text style={{ color: channel === 'email' ? c.primary : c.textMuted, fontSize: typography.xs }}>
                    邮箱
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.row, { marginTop: 6 }]}>
                <TextInput
                  style={[styles.input, { color: c.text, borderColor: c.border, flex: 1, marginRight: 8 }]}
                  placeholder="验证码"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
                />
                <Pressable
                  onPress={handleSendCode}
                  disabled={sendingCode || countdown > 0}
                  style={[styles.btn, { backgroundColor: c.border, paddingHorizontal: 12, opacity: sendingCode || countdown > 0 ? 0.6 : 1 }]}
                >
                  <Text style={[styles.btnText, { color: c.text }]}>
                    {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中' : '获取验证码'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border }]}
            placeholder="新支付密码（6 位数字）"
            placeholderTextColor={c.textMuted}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={newPwd}
            onChangeText={(t) => setNewPwd(t.replace(/\D/g, ''))}
          />
          <Pressable style={[styles.btn, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1 }]} onPress={handleSavePassword} disabled={busy}>
            <Text style={styles.btnText}>
              {pwdMode === 'reset' ? '重置支付密码' : pwdMode === 'set' ? '设置支付密码' : '保存新支付密码'}
            </Text>
          </Pressable>
          {policy && (
            <Text style={[styles.muted, { color: c.textMuted, marginTop: 6 }]}>
              连续错误 {policy.max_fails} 次将锁定 {policy.lock_minutes} 分钟，忘记密码可用验证码重置
            </Text>
          )}
          <Pressable
            style={[styles.switchRow, { borderTopColor: c.border }]}
            onPress={() => snap?.pay_password_set && toggleRequired(!snap?.pay_password_required)}
          >
            <View style={styles.row}>
              <ShieldCheck size={14} color={c.textMuted} />
              <Text style={{ color: c.text, fontSize: typography.xs, marginLeft: 6 }}>扣费前校验支付密码</Text>
            </View>
            <Text style={{ color: snap?.pay_password_required ? '#10b981' : c.textMuted, fontSize: typography.xs }}>
              {snap?.pay_password_required ? '已开启' : '已关闭'}
            </Text>
          </Pressable>
        </View>

        {/* 流水 */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>AI 钱包流水</Text>
          {flows.length === 0 ? (
            <Text style={[styles.muted, { color: c.textMuted, marginTop: spacing.sm }]}>暂无流水</Text>
          ) : (
            flows.map((f) => (
              <View key={f.id} style={[styles.flowRow, { borderTopColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: typography.sm }}>{FLOW_LABEL[f.type] || f.type}</Text>
                  <Text style={{ color: c.textMuted, fontSize: typography.xs }}>{f.description}</Text>
                </View>
                <Text style={{ color: f.type === 'consume' ? '#ef4444' : '#10b981', fontSize: typography.sm }}>
                  {f.type === 'consume' ? '-' : '+'}¥{f.amount}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { borderRadius: radius.lg, padding: spacing.lg },
  heroLabel: { color: '#fff', fontSize: typography.sm, marginLeft: 6 },
  heroBalance: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: typography.xs, marginTop: 4 },
  heroWarn: { color: 'rgba(255,255,255,0.85)', fontSize: typography.xs, marginTop: spacing.sm, backgroundColor: 'rgba(255,255,255,0.15)', padding: 6, borderRadius: 6 },
  card: { borderRadius: radius.lg, padding: spacing.md },
  cardTitle: { fontSize: typography.base, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  muted: { fontSize: typography.xs },
  warn: { fontSize: typography.xs, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 10, marginTop: spacing.sm, fontSize: typography.sm },
  btn: { marginTop: spacing.sm, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: typography.sm, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1 },
  flowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1 },
});
