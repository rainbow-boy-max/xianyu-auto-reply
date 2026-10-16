import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Input, Loading } from '@/components/ui';
import { ShieldCheck, ShieldAlert } from 'lucide-react-native';
import { colors, spacing, typography } from '@/lib/theme';
import { getPhoneStatus, verifyRealName, type PhoneStatus } from '@/api/wrappers/phone-auth';

/**
 * 实人认证（三要素：姓名 + 身份证号 + 手机号）
 * 对齐 web /real-name 与后端 POST /api/v1/user/real-name/verify。
 */
export default function RealNameScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setStatus(await getPhoneStatus());
    } catch (e) {
      Alert.alert('提示', (e as Error)?.message || '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    const name = realName.trim();
    const idc = idCard.trim().toUpperCase();
    const ph = phone.trim();
    if (!name) return Alert.alert('提示', '请输入真实姓名');
    if (!/^\d{17}[\dX]$/.test(idc)) return Alert.alert('提示', '请输入正确的 18 位身份证号');
    if (!/^1\d{10}$/.test(ph)) return Alert.alert('提示', '请输入正确的 11 位手机号');
    try {
      setSubmitting(true);
      const res = await verifyRealName(name, idc, ph);
      if (res.success) {
        Alert.alert('认证通过', res.message || '实人认证通过');
        setRealName('');
        setIdCard('');
        setPhone('');
        await load();
      } else {
        Alert.alert('认证未通过', res.message || '请核对姓名、身份证号与手机号是否一致');
      }
    } catch (e) {
      Alert.alert('认证失败', (e as Error)?.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  const verified = Boolean(status?.real_name_verified);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.mb}>
            <View style={styles.statusRow}>
              {verified ? (
                <ShieldCheck size={22} color={c.success} />
              ) : (
                <ShieldAlert size={22} color={c.warning} />
              )}
              <View style={styles.statusText}>
                <Text style={[styles.statusTitle, { color: c.text }]}>
                  {verified ? '已通过实人认证' : '未完成实人认证'}
                </Text>
                <Text style={[styles.statusDesc, { color: c.textSecondary }]}>
                  {verified
                    ? `姓名：${status?.real_name_masked || '—'}`
                    : '为符合监管要求，完成认证后才能使用全部业务功能。'}
                </Text>
              </View>
            </View>
          </Card>

          {!verified && (
            <Card>
              <Text style={[styles.sectionTitle, { color: c.text }]}>三要素认证</Text>
              <Text style={[styles.hint, { color: c.textMuted }]}>
                手机号需与姓名、身份证号的实名信息一致
              </Text>

              <Text style={[styles.label, { color: c.textSecondary }]}>真实姓名</Text>
              <Input value={realName} onChangeText={setRealName} placeholder="请输入真实姓名" />

              <Text style={[styles.label, { color: c.textSecondary }]}>身份证号</Text>
              <Input
                value={idCard}
                onChangeText={setIdCard}
                placeholder="请输入 18 位身份证号"
                autoCapitalize="characters"
                maxLength={18}
              />

              <Text style={[styles.label, { color: c.textSecondary }]}>手机号</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="请输入 11 位手机号"
                keyboardType="number-pad"
                maxLength={11}
              />

              <Button
                label="提交认证"
                onPress={submit}
                loading={submitting}
                style={styles.submit}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: spacing.lg },
  mb: { marginBottom: spacing.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusText: { flex: 1, marginLeft: spacing.sm },
  statusTitle: { ...typography.heading },
  statusDesc: { ...typography.small, marginTop: 2 },
  sectionTitle: { ...typography.heading, marginBottom: spacing.xs },
  hint: { ...typography.small, marginBottom: spacing.md },
  label: { ...typography.small, marginTop: spacing.md, marginBottom: spacing.xs },
  submit: { marginTop: spacing.lg },
});
