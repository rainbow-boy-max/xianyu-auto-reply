/**
 * 法律文书页：用户协议 / 隐私政策（APP 同步补丁 2026-10-13）
 *
 * 顶部自带返回与标签切换，未登录也可访问（注册页会跳转过来）。
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '@/lib/theme';
import { getLegalDocuments, type LegalDocuments } from '@/api/wrappers/account-security';

export default function LegalScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [tab, setTab] = useState<'terms' | 'privacy'>('terms');
  const [docs, setDocs] = useState<LegalDocuments | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLegalDocuments()
      .then((d) => setDocs(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const current = tab === 'terms' ? docs?.terms : docs?.privacy;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.borderLight }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={22} stroke={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>
          {current?.title ?? '法律文书'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: c.borderLight }]}>
        {([
          { key: 'terms' as const, label: '用户协议' },
          { key: 'privacy' as const, label: '隐私政策' },
        ]).map((t) => {
          const active = t.key === tab;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? c.primary : c.textSecondary },
                  active && styles.tabLabelActive,
                ]}
              >
                {t.label}
              </Text>
              {active && <View style={[styles.tabIndicator, { backgroundColor: c.primary }]} />}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.body, { color: c.text }]}>{current?.content ?? '暂无内容'}</Text>
          {docs?.updated_at ? (
            <Text style={[styles.updated, { color: c.textMuted }]}>
              最后更新：{docs.updated_at}
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.heading, flex: 1, textAlign: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabLabel: { ...typography.body },
  tabLabelActive: { fontWeight: '700' },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg },
  body: { ...typography.body, lineHeight: 24 },
  updated: { ...typography.caption, marginTop: spacing.lg },
});
