/**
 * 通知渠道管理（[通知体系重构 2026-10-15]）
 *
 * 与网页端一致：按后端下发的 `channel_fields` **动态渲染表单**，
 * 取代原来写死的「Webhook 地址 + Token」两字段；邮件只需填接收邮箱。
 * 新增渠道类型时无需改 APP，后端注册表加字段即可。
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Input, Loading, EmptyState } from '@/components/ui';
import { colors, spacing, typography, radius } from '@/lib/theme';
import {
  getNotificationChannels,
  createNotificationChannel,
  updateNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel,
  getNotifyMatrix,
  type NotificationChannel,
  type NotifyChannelField,
  type NotifyRegistry,
} from '@/api/wrappers/notifications';

/** 内置兜底字段定义（注册表不可用时仍可配置常用渠道） */
const FALLBACK_FIELDS: Record<string, NotifyChannelField[]> = {
  email: [{ name: 'recipient_email', label: '接收邮箱', type: 'text', required: true, placeholder: 'you@example.com', help: '系统使用平台已配置的邮件服务发送，无需填写 SMTP。' }],
  wechat: [{ name: 'webhook_url', label: '企业微信机器人 Webhook', type: 'url', required: true, placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' }],
  dingtalk: [{ name: 'webhook_url', label: '钉钉机器人 Webhook', type: 'url', required: true, placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' }],
  feishu: [{ name: 'webhook_url', label: '飞书机器人 Webhook', type: 'url', required: true, placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' }],
  bark: [{ name: 'device_key', label: '设备密钥 Device Key', type: 'text', required: true, placeholder: '在 Bark App 首页可见' }],
  telegram: [{ name: 'bot_token', label: 'Bot Token', type: 'text', required: true, placeholder: '123456:ABC-DEF...' }, { name: 'chat_id', label: 'Chat ID', type: 'text', required: true, placeholder: '如 123456789' }],
  pushplus: [{ name: 'token', label: 'Token', type: 'text', required: true, placeholder: 'pushplus 官网获取' }],
  webhook: [{ name: 'webhook_url', label: '请求地址', type: 'url', required: true, placeholder: 'https://your-server/hook' }],
};

export default function NotificationChannelsScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];

  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [registry, setRegistry] = useState<NotifyRegistry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async (force = false) => {
    try {
      if (force) setRefreshing(true);
      const [list, reg] = await Promise.all([
        getNotificationChannels(),
        getNotifyMatrix().then((m) => m?.registry ?? null).catch(() => null),
      ]);
      setChannels(list);
      if (reg) setRegistry(reg);
    } catch (e) {
      Alert.alert('加载失败', (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  /** 可配置渠道类型（来自注册表；缺失时用兜底） */
  const typeOptions = (registry?.channels || [])
    .filter((ch) => ch.kind === 'config')
    .map((ch) => ({ key: ch.key, label: ch.label, desc: ch.desc }));

  const effectiveTypeOptions = typeOptions.length > 0
    ? typeOptions
    : Object.keys(FALLBACK_FIELDS).map((k) => ({ key: k, label: k, desc: '' }));

  function fieldsFor(type: string): NotifyChannelField[] {
    return registry?.channel_fields?.[type] || FALLBACK_FIELDS[type] || [];
  }

  function typeLabel(type: string): string {
    const found = (registry?.channels || []).find((ch) => ch.key === type);
    if (found) return found.label;
    return effectiveTypeOptions.find((t) => t.key === type)?.label ?? type;
  }

  function openAdd() {
    const first = effectiveTypeOptions[0]?.key || 'email';
    setEditingId(null);
    setFormName('');
    setFormType(first);
    setFormValues({});
    setEditorVisible(true);
  }

  function openEdit(ch: NotificationChannel) {
    setEditingId(ch.id);
    setFormName(ch.name);
    setFormType(ch.type);
    const cfg = (ch.config || {}) as Record<string, unknown>;
    const values: Record<string, string> = {};
    Object.entries(cfg).forEach(([k, v]) => { values[k] = v == null ? '' : String(v); });
    setFormValues(values);
    setEditorVisible(true);
  }

  async function handleSave() {
    if (!formType) { Alert.alert('提示', '请选择渠道类型'); return; }
    const fields = fieldsFor(formType);
    const config: Record<string, unknown> = {};
    for (const f of fields) {
      const v = (formValues[f.name] || '').trim();
      if (f.required && !v) { Alert.alert('提示', `请填写「${f.label}」`); return; }
      if (v) config[f.name] = v;
    }
    setSaving(true);
    try {
      const name = formName.trim() || typeLabel(formType);
      if (editingId == null) {
        await createNotificationChannel(name, formType, config);
      } else {
        await updateNotificationChannel(editingId, { name, type: formType, config });
      }
      setEditorVisible(false);
      await loadAll();
    } catch (e) {
      Alert.alert('保存失败', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(ch: NotificationChannel) {
    const next = !ch.enabled;
    setChannels((prev) => prev.map((x) => (x.id === ch.id ? { ...x, enabled: next } : x)));
    try { await updateNotificationChannel(ch.id, { enabled: next }); }
    catch (e) {
      setChannels((prev) => prev.map((x) => (x.id === ch.id ? { ...x, enabled: !next } : x)));
      Alert.alert('操作失败', (e as Error).message);
    }
  }

  function handleDelete(ch: NotificationChannel) {
    Alert.alert('确认删除', `删除渠道「${ch.name}」？`, [
      { text: '取消' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try { await deleteNotificationChannel(ch.id); await loadAll(); }
        catch (e) { Alert.alert('删除失败', (e as Error).message); }
      } },
    ]);
  }

  async function handleTest(ch: NotificationChannel) {
    try {
      const res = await testNotificationChannel(ch.id);
      Alert.alert(res.success ? '测试已发送' : '测试失败', res.message || '');
    } catch (e) {
      Alert.alert('测试失败', (e as Error).message);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
        <Loading label="加载通知渠道..." />
      </SafeAreaView>
    );
  }

  const currentFields = fieldsFor(formType);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.headerHint, { color: c.textSecondary }]}>
          配置通知接收渠道，配置后到「消息通知」勾选事件即可收到提醒。
        </Text>
        <Button label="新增渠道" onPress={openAdd} />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} />}
      >
        {channels.length === 0 ? (
          <EmptyState title="暂无通知渠道" message="点击上方「新增渠道」开始配置" />
        ) : (
          channels.map((ch) => (
            <Card key={ch.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{ch.name}</Text>
                  <View style={[styles.badge, { backgroundColor: c.primaryLight }]}>
                    <Text style={[styles.badgeText, { color: c.primary }]}>{typeLabel(ch.type)}</Text>
                  </View>
                </View>
                <Switch
                  value={ch.enabled}
                  onValueChange={() => handleToggle(ch)}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
              <View style={styles.actions}>
                <Button label="测试" variant="secondary" onPress={() => handleTest(ch)} style={styles.actionBtn} />
                <Button label="编辑" variant="secondary" onPress={() => openEdit(ch)} style={styles.actionBtn} />
                <Button label="删除" variant="danger" onPress={() => handleDelete(ch)} style={styles.actionBtn} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {editorVisible && (
        <View style={[styles.sheetOverlay, { backgroundColor: c.overlay }]}>
          <Pressable style={styles.overlayTouchable} onPress={() => setEditorVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              {editingId == null ? '新增通知渠道' : '编辑通知渠道'}
            </Text>
            <ScrollView style={styles.sheetScroll}>
              <Text style={[styles.label, { color: c.textSecondary }]}>渠道类型</Text>
              <View style={styles.chips}>
                {effectiveTypeOptions.map((t) => {
                  const on = formType === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => { setFormType(t.key); setFormValues({}); }}
                      style={[styles.chip, { backgroundColor: on ? c.primary : c.background, borderColor: on ? c.primary : c.border }]}
                    >
                      <Text style={[styles.chipText, { color: on ? '#FFF' : c.text }]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>渠道名称</Text>
              <Input
                value={formName}
                onChangeText={setFormName}
                placeholder={`留空则使用「${typeLabel(formType)}」`}
              />

              {currentFields.map((f) => (
                <View key={f.name} style={{ marginTop: spacing.md }}>
                  <Text style={[styles.label, { color: c.textSecondary }]}>
                    {f.label}{f.required ? ' *' : ''}
                  </Text>
                  <Input
                    value={formValues[f.name] || ''}
                    onChangeText={(t) => setFormValues((v) => ({ ...v, [f.name]: t }))}
                    placeholder={f.placeholder || ''}
                    autoCapitalize="none"
                  />
                  {f.help ? (
                    <Text style={[styles.tinyHint, { color: c.textMuted }]}>{f.help}</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
            <View style={styles.sheetActions}>
              <Button label="取消" variant="secondary" onPress={() => setEditorVisible(false)} style={styles.sheetBtn} />
              <Button label="保存" onPress={handleSave} loading={saving} style={styles.sheetBtn} />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  headerHint: { ...typography.caption, lineHeight: 18 },
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  card: { gap: spacing.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.body, fontWeight: '600' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, minHeight: 36 },
  sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  overlayTouchable: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sheetScroll: { flexGrow: 0 },
  sheetTitle: { ...typography.heading, textAlign: 'center', marginBottom: spacing.md },
  label: { ...typography.caption, marginBottom: 4 },
  tinyHint: { ...typography.caption, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1 },
  chipText: { ...typography.caption, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  sheetBtn: { flex: 1 },
});
