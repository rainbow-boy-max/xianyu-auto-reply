/**
 * 消息通知（[通知体系重构 2026-10-15]）
 *
 * 与网页端一致：改为「事件 × 渠道」订阅矩阵。
 * - 系统预设通知事件，用户为每个事件勾选想用的渠道
 * - 顶部可设置短信接收手机号与邮件收件地址（邮件由系统统一发出）
 * - 每个事件可「测试」一次，返回实际发送结果
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Input, Loading, EmptyState } from '@/components/ui';
import { colors, spacing, typography, radius } from '@/lib/theme';
import {
  getNotifyMatrix,
  setNotifySubscription,
  putNotifyPrefs,
  testNotifyEvent,
  type NotifyMatrixData,
  type NotifyChannelOption,
  type NotifyPrefs,
} from '@/api/wrappers/notifications';

export default function MessageNotificationsScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];

  const [data, setData] = useState<NotifyMatrixData | null>(null);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [prefs, setPrefs] = useState<NotifyPrefs>({ sms_phone: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testingKey, setTestingKey] = useState('');

  const loadAll = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      const res = await getNotifyMatrix();
      if (res) {
        setData(res);
        setMatrix(res.matrix || {});
        setPrefs({
          sms_phone: res.prefs?.sms_phone || '',
          email: res.prefs?.email || '',
          account_phone: res.prefs?.account_phone || '',
          account_email: res.prefs?.account_email || '',
        });
      }
    } catch (e) {
      Alert.alert('加载失败', (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const options: NotifyChannelOption[] = [
    ...(data?.builtin_channels || []),
    ...(data?.configured_channels || []),
  ];

  async function toggle(eventKey: string, channelKey: string, checked: boolean) {
    const prev = matrix[eventKey] || [];
    const next = checked ? [...prev, channelKey] : prev.filter((k) => k !== channelKey);
    setMatrix((m) => ({ ...m, [eventKey]: next }));
    try {
      const res = await setNotifySubscription(eventKey, channelKey, checked);
      if (res.success === false) {
        Alert.alert('保存失败', res.message || '请稍后重试');
        setMatrix((m) => ({ ...m, [eventKey]: prev }));
      }
    } catch (e) {
      setMatrix((m) => ({ ...m, [eventKey]: prev }));
      Alert.alert('保存失败', (e as Error).message);
    }
  }

  async function savePrefs() {
    setSavingPrefs(true);
    try {
      const res = await putNotifyPrefs(prefs.sms_phone || '', prefs.email || '');
      Alert.alert(res.success === false ? '保存失败' : '已保存', res.message || '通知接收方式已更新');
    } catch (e) {
      Alert.alert('保存失败', (e as Error).message);
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleTest(eventKey: string) {
    setTestingKey(eventKey);
    try {
      const res = await testNotifyEvent(eventKey);
      Alert.alert(res.success ? '测试已发送' : '测试未发送成功', res.message || '');
    } catch (e) {
      Alert.alert('测试失败', (e as Error).message);
    } finally {
      setTestingKey('');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Loading label="加载通知订阅..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} />}
      >
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          为每个通知事件勾选想使用的渠道。通知内容由系统预设，无需自行编写；
          渠道需先到「通知渠道」配置，短信需先绑定手机号。
        </Text>

        {/* 通知接收方式 */}
        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>我的通知接收方式</Text>
          <Text style={[styles.label, { color: c.textSecondary }]}>短信接收手机号</Text>
          <Input
            value={prefs.sms_phone || ''}
            onChangeText={(t) => setPrefs((p) => ({ ...p, sms_phone: t }))}
            placeholder={prefs.account_phone ? `留空则用账号手机号 ${prefs.account_phone}` : '尚未绑定手机号'}
            keyboardType="phone-pad"
          />
          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.sm }]}>邮件接收地址</Text>
          <Input
            value={prefs.email || ''}
            onChangeText={(t) => setPrefs((p) => ({ ...p, email: t }))}
            placeholder={prefs.account_email ? `留空则用账号邮箱 ${prefs.account_email}` : '接收通知的邮箱'}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={[styles.tinyHint, { color: c.textMuted }]}>邮件由系统统一发送，无需填写邮箱服务器。</Text>
          <Button
            label="保存接收方式"
            onPress={savePrefs}
            loading={savingPrefs}
            style={{ marginTop: spacing.sm }}
          />
        </Card>

        {options.length === 0 ? (
          <EmptyState title="暂无可选渠道" message="请先到「通知渠道」页配置渠道" />
        ) : (
          (data?.events || []).map((ev) => {
            const checked = matrix[ev.key] || [];
            return (
              <Card key={ev.key} style={styles.card}>
                <View style={styles.eventHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventLabel, { color: c.text }]}>{ev.label}</Text>
                    <Text style={[styles.eventDesc, { color: c.textMuted }]}>{ev.desc}</Text>
                  </View>
                  <Button
                    label={testingKey === ev.key ? '发送中' : '测试'}
                    variant="secondary"
                    onPress={() => handleTest(ev.key)}
                    disabled={testingKey === ev.key}
                  />
                </View>
                <View style={styles.chips}>
                  {options.map((o) => {
                    const on = checked.includes(o.key);
                    return (
                      <Pressable
                        key={o.key}
                        onPress={() => toggle(ev.key, o.key, !on)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: on ? c.primary : c.background,
                            borderColor: on ? c.primary : c.border,
                          },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: on ? '#FFF' : c.text }]}>
                          {on ? '✓ ' : ''}{o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            );
          })
        )}

        {testingKey !== '' && (
          <View style={styles.testing}>
            <ActivityIndicator color={c.primary} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md },
  hint: { ...typography.caption, lineHeight: 18 },
  card: { gap: spacing.xs },
  sectionTitle: { ...typography.heading, marginBottom: spacing.xs },
  label: { ...typography.caption, marginBottom: 4 },
  tinyHint: { ...typography.caption, marginTop: 4 },
  eventHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eventLabel: { ...typography.body, fontWeight: '600' },
  eventDesc: { ...typography.caption, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  chipText: { ...typography.caption, fontWeight: '600' },
  testing: { alignItems: 'center', paddingVertical: spacing.md },
});
