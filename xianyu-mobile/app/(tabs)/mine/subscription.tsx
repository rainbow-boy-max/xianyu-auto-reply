import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, Check, X, ChevronRight, Wallet } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '@/lib/theme';
import {
  getEntitlements,
  getPlans,
  getMySubscriptions,
  purchasePlan,
  type Entitlements,
  type Plan,
  type SubscriptionRecord,
} from '@/api/wrappers/subscription';
import { logger } from '@/lib/logger';

type Period = 'month' | 'quarter' | 'year';
const PERIOD_LABEL: Record<Period, string> = { month: '月付', quarter: '季付', year: '年付' };

export default function SubscriptionScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [records, setRecords] = useState<SubscriptionRecord[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buying, setBuying] = useState('');

  const load = useCallback(async () => {
    try {
      const [e, p, r] = await Promise.all([getEntitlements(), getPlans(), getMySubscriptions()]);
      setEnt(e);
      setPlans(p);
      setRecords(r);
    } catch (err) {
      logger.error('Subscription', '加载失败', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const priceOf = (plan: Plan) =>
    ({ month: plan.price_month, quarter: plan.price_quarter, year: plan.price_year }[period] || '');

  const handleBuy = async (plan: Plan) => {
    if (plan.is_full) {
      Alert.alert('提示', '该套餐仅供存量用户使用，不可购买');
      return;
    }
    const price = priceOf(plan);
    if (!price || Number(price) <= 0) {
      Alert.alert('提示', '该套餐为免费套餐，无需购买');
      return;
    }
    Alert.alert('确认购买', `确认用账户余额购买「${plan.name}」（${PERIOD_LABEL[period]}）¥${price}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        onPress: async () => {
          setBuying(plan.code);
          try {
            const res = await purchasePlan(plan.code, period);
            Alert.alert('成功', res ? `已开通，到期时间 ${String(res.end_at).slice(0, 10)}` : '开通成功');
            await load();
          } catch (err: any) {
            Alert.alert('失败', err?.message || '购买失败');
          } finally {
            setBuying('');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} />
      </SafeAreaView>
    );
  }

  const plan = ent?.plan;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* 当前套餐 */}
        <View style={[styles.hero, { backgroundColor: c.primary }]}>
          <View style={styles.heroRow}>
            <Crown size={26} color="#fff" />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={styles.heroTitle}>当前套餐：{plan?.name || '免费版'}</Text>
              <Text style={styles.heroSub}>
                {ent?.subscription?.end_at
                  ? `到期 ${String(ent.subscription.end_at).slice(0, 10)}${ent.subscription.days_left != null ? `（剩 ${ent.subscription.days_left} 天）` : ''}`
                  : '长期有效'}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <Text style={styles.heroStat}>
              AI 折扣 {plan && Number(plan.ai_discount) < 1 ? `${(Number(plan.ai_discount) * 10).toFixed(1)} 折` : '无'}
            </Text>
            <Text style={styles.heroStat}>免费文案 {plan?.ai_free_text ?? 0}</Text>
            <Text style={styles.heroStat}>免费图片 {plan?.ai_free_image ?? 0}</Text>
          </View>
        </View>

        {/* AI 钱包入口 */}
        <Pressable
          style={[styles.card, { backgroundColor: c.surface }]}
          onPress={() => router.push('/(tabs)/mine/ai-wallet')}
        >
          <View style={styles.rowBetween}>
            <View style={styles.row}>
              <Wallet size={18} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.text, marginLeft: spacing.sm }]}>AI 钱包</Text>
            </View>
            <ChevronRight size={18} color={c.textMuted} />
          </View>
          <Text style={[styles.muted, { color: c.textMuted, marginTop: 4 }]}>
            充值 / 从账户余额划入 / 支付密码设置
          </Text>
        </Pressable>

        {/* 周期切换 */}
        <View style={styles.periodRow}>
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, { backgroundColor: period === p ? c.primary : c.surface }]}
            >
              <Text style={{ color: period === p ? '#fff' : c.textMuted, fontSize: typography.sm }}>
                {PERIOD_LABEL[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 套餐列表 */}
        {plans.filter((p) => !p.is_full).map((p) => {
          const isCurrent = p.code === plan?.code;
          const price = priceOf(p);
          return (
            <View key={p.code} style={[styles.card, { backgroundColor: c.surface, borderColor: isCurrent ? c.primary : c.border, borderWidth: isCurrent ? 2 : 1 }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, { color: c.text }]}>{p.name}</Text>
                {isCurrent && <Text style={[styles.tag, { backgroundColor: c.primary }]}>当前</Text>}
              </View>
              <Text style={[styles.muted, { color: c.textMuted, marginTop: 2 }]}>{p.description}</Text>
              <Text style={[styles.price, { color: c.primary }]}>
                {Number(price) > 0 ? `¥${price} / ${PERIOD_LABEL[period]}` : '免费'}
              </Text>
              <View style={styles.featureList}>
                <FeatureRow ok text={`账号数量 ${p.features.find((f) => f.feature_key === 'accounts')?.quota ?? '不限'}`} c={c} />
                <FeatureRow ok={p.features.some((f) => f.feature_key === 'ai_listing') || p.is_full} text="AI 铺货" c={c} />
                <FeatureRow ok={p.features.some((f) => f.feature_key === 'publish_batch') || p.is_full} text="批量发布" c={c} />
                <FeatureRow ok={p.features.some((f) => f.feature_key === 'distribution_dealers') || p.is_full} text="分销管理" c={c} />
                <FeatureRow ok={p.allow_custom_text_model} text="自定义文案模型" c={c} />
              </View>
              <Pressable
                onPress={() => handleBuy(p)}
                disabled={buying === p.code}
                style={[styles.buyBtn, { backgroundColor: c.primary, opacity: buying === p.code ? 0.6 : 1 }]}
              >
                <Text style={styles.buyBtnText}>
                  {buying === p.code ? '处理中...' : isCurrent ? '续费' : '立即开通'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {/* 订阅记录 */}
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>订阅记录</Text>
          {records.length === 0 ? (
            <Text style={[styles.muted, { color: c.textMuted, marginTop: spacing.sm }]}>暂无记录</Text>
          ) : (
            records.map((r) => (
              <View key={r.id} style={[styles.recordRow, { borderTopColor: c.border }]}>
                <View>
                  <Text style={{ color: c.text, fontSize: typography.sm }}>{r.plan_name}</Text>
                  <Text style={{ color: c.textMuted, fontSize: typography.xs }}>
                    {String(r.start_at || '').slice(0, 10)} ~ {r.end_at ? String(r.end_at).slice(0, 10) : '长期'}
                  </Text>
                </View>
                <Text style={{ color: r.status === 'active' ? '#10b981' : c.textMuted, fontSize: typography.xs }}>
                  {r.status === 'active' ? '生效中' : r.status === 'expired' ? '已过期' : '已变更'}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ ok, text, c }: { ok: boolean; text: string; c: any }) {
  return (
    <View style={styles.featureRow}>
      {ok ? <Check size={14} color="#10b981" /> : <X size={14} color={c.textMuted} />}
      <Text style={{ color: ok ? c.text : c.textMuted, fontSize: typography.xs, marginLeft: 6 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  hero: { borderRadius: radius.lg, padding: spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { color: '#fff', fontSize: typography.base, fontWeight: '600' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: typography.xs, marginTop: 2 },
  heroStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  heroStat: { color: 'rgba(255,255,255,0.9)', fontSize: typography.xs },
  card: { borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'transparent' },
  cardTitle: { fontSize: typography.base, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { fontSize: typography.xs },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.md },
  tag: { color: '#fff', fontSize: typography.xs, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  price: { fontSize: typography.lg, fontWeight: '700', marginTop: spacing.sm },
  featureList: { marginTop: spacing.sm, gap: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  buyBtn: { marginTop: spacing.md, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  buyBtnText: { color: '#fff', fontSize: typography.sm, fontWeight: '600' },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1 },
});
