/**
 * 兑换中心（移动端）
 *
 * 输入卡密兑换：会员套餐 / AI 钱包余额 / 账户余额。
 * 复用 web 端接口 POST /api/v1/redeem
 */
import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { Ticket, Sparkles, ShieldCheck } from 'lucide-react-native';
import { Card } from '@/components/ui';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { redeemCode, type RedeemResult } from '@/api/wrappers/redeem';
import { logger } from '@/lib/logger';

export default function RedeemScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);

  const handleRedeem = async () => {
    const value = code.trim();
    if (!value) {
      Alert.alert('提示', '请输入卡密');
      return;
    }
    setBusy(true);
    try {
      const res = await redeemCode(value);
      setResult(res);
      Alert.alert('兑换成功', `已兑换：${res?.type_label ?? '成功'}`);
      setCode('');
    } catch (err: any) {
      Alert.alert('兑换失败', err?.message || '请核对卡密后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <View style={styles.row}>
            <Ticket size={16} color={c.primary} />
            <Text style={[styles.title, { color: c.text, marginLeft: 6 }]}>兑换中心</Text>
          </View>
          <Text style={[styles.muted, { color: c.textMuted, marginTop: spacing.xs }]}>
            输入卡密即可兑换会员套餐、AI 钱包余额或账户余额。每张卡密仅可使用一次。
          </Text>

          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border, marginTop: spacing.md }]}
            placeholder="如 VIP-XXXX-XXXX-XXXX"
            placeholderTextColor={c.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
          />

          <Pressable
            style={[styles.btn, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1 }]}
            onPress={handleRedeem}
            disabled={busy}
          >
            <Sparkles size={14} color="#FFF" />
            <Text style={[styles.btnText, { marginLeft: 6 }]}>{busy ? '兑换中...' : '立即兑换'}</Text>
          </Pressable>

          {result && (
            <View style={[styles.resultBox, { borderColor: c.border }]}>
              <Text style={{ color: '#10b981', fontSize: typography.sm, fontWeight: '600' }}>
                兑换成功：{result.type_label}
              </Text>
              <Text style={[styles.muted, { color: c.textMuted, marginTop: 4 }]}>
                {result.type === 'subscription' && '会员已开通/续期，可在「会员中心」查看。'}
                {result.type === 'ai_wallet' && '已充入 AI 钱包，可在「AI 钱包」查看余额。'}
                {result.type === 'balance' && '已充入账户余额，可在「个人设置」查看余额。'}
              </Text>
            </View>
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.row}>
            <ShieldCheck size={16} color={c.textMuted} />
            <Text style={[styles.muted, { color: c.textSecondary, marginLeft: 6, fontWeight: '600' }]}>说明</Text>
          </View>
          <Text style={[styles.muted, { color: c.textMuted, marginTop: spacing.xs }]}>
            卡密不记名、不挂失，请妥善保管；已被使用或已过期的卡密无法再次兑换。
          </Text>
          <Text style={[styles.muted, { color: c.textMuted, marginTop: 4 }]}>
            如遇兑换失败，请核对卡密是否输入完整（含前缀与分隔符）。
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  section: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { ...typography.title },
  muted: { ...typography.small, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    letterSpacing: 1,
  },
  btn: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnText: { color: '#FFF', fontSize: typography.body.fontSize, fontWeight: '600' },
  resultBox: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
