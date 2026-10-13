import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Eye, EyeOff, Check, X } from 'lucide-react-native';
import { Button, Input, Card } from '@/components/ui';
import { GeetestCaptcha } from '@/components/GeetestCaptcha';
import { colors, spacing, typography } from '@/lib/theme';
import {
  sendEmailCodeWithGeetest,
  sendSmsCode,
  registerFull,
  getPasswordPolicy,
  checkPassword,
  DEFAULT_PASSWORD_POLICY,
  type PasswordPolicy,
} from '@/api/wrappers/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string) {
  return EMAIL_RE.test(email);
}

/** 60 秒倒计时 hook */
function useCountdown() {
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  const start = useCallback(() => setCountdown(60), []);
  return { countdown, start, running: countdown > 0 };
}

export default function RegisterScreen() {
  const scheme = useColorScheme();
  const c = colors[scheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_PASSWORD_POLICY);
  const emailCountdown = useCountdown();
  const smsCountdown = useCountdown();

  // 极验滑块（发送验证码前必须先通过）
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaTarget, setCaptchaTarget] = useState<'email' | 'sms'>('email');
  const [geetestChallenge, setGeetestChallenge] = useState('');

  useEffect(() => {
    getPasswordPolicy()
      .then((p) => setPolicy(p))
      .catch(() => {});
  }, []);

  const strength = checkPassword(password, policy);
  const emailValid = isValidEmail(email.trim());
  const phoneValid = /^1\d{10}$/.test(phone.trim());

  function openCaptcha(target: 'email' | 'sms') {
    setCaptchaTarget(target);
    setCaptchaVisible(true);
  }

  async function handleCaptchaSuccess(challenge: string) {
    setGeetestChallenge(challenge);
    setCaptchaVisible(false);
    if (captchaTarget === 'email') {
      await doSendEmailCode(challenge);
    } else {
      await doSendSmsCode(challenge);
    }
  }

  async function doSendEmailCode(challenge: string) {
    if (!emailValid) {
      Alert.alert('提示', '请先输入正确的邮箱');
      return;
    }
    if (emailCountdown.running) return;
    setSendingEmail(true);
    try {
      const resp = await sendEmailCodeWithGeetest(email.trim(), 'register', challenge);
      if (resp.success) {
        emailCountdown.start();
        Alert.alert('已发送', '邮箱验证码已发送');
      } else {
        Alert.alert('发送失败', resp.message || '请稍后重试');
      }
    } catch (e) {
      Alert.alert('发送失败', (e as Error).message);
    } finally {
      setSendingEmail(false);
      setGeetestChallenge('');
    }
  }

  async function doSendSmsCode(challenge: string) {
    if (!phoneValid) {
      Alert.alert('提示', '请先输入正确的 11 位手机号');
      return;
    }
    if (smsCountdown.running) return;
    setSendingSms(true);
    try {
      const resp = await sendSmsCode(phone.trim(), 'register', challenge);
      if (resp.success) {
        smsCountdown.start();
        Alert.alert('已发送', '短信验证码已发送');
      } else {
        Alert.alert('发送失败', resp.message || '请稍后重试');
      }
    } catch (e) {
      Alert.alert('发送失败', (e as Error).message);
    } finally {
      setSendingSms(false);
      setGeetestChallenge('');
    }
  }

  async function handleRegister() {
    if (!username.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    if (!emailValid) {
      Alert.alert('提示', '请输入正确的邮箱');
      return;
    }
    if (!phoneValid) {
      Alert.alert('提示', '请输入正确的 11 位手机号');
      return;
    }
    if (!password) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    if (!strength.ok) {
      Alert.alert('密码强度不符合要求', strength.message);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }
    if (!emailCode.trim()) {
      Alert.alert('提示', '请输入邮箱验证码');
      return;
    }
    if (!smsCode.trim()) {
      Alert.alert('提示', '请输入手机验证码');
      return;
    }
    if (!agreed) {
      Alert.alert('提示', '请先确认年满 18 周岁并同意《用户协议》与《隐私政策》');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await registerFull({
        username: username.trim(),
        email: email.trim(),
        email_code: emailCode.trim(),
        phone: phone.trim(),
        sms_code: smsCode.trim(),
        password,
      });
      if (resp.success) {
        Alert.alert('注册成功', '请使用新账号登录', [
          { text: '去登录', onPress: () => router.replace('/(onboarding)/login') },
        ]);
      } else {
        Alert.alert('注册失败', resp.message ?? '未知错误');
      }
    } catch (e) {
      Alert.alert('注册失败', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const strengthLabel: Record<string, string> = {
    length: `长度至少 ${policy.min_length || 8} 位`,
    upper: '包含大写字母（A-Z）',
    lower: '包含小写字母（a-z）',
    digit: '包含数字（0-9）',
    special: '包含特殊字符',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: c.text }]}>注册账号</Text>

        <Card style={styles.form}>
          <Text style={[styles.label, { color: c.textSecondary }]}>用户名</Text>
          <Input
            value={username}
            onChangeText={setUsername}
            placeholder="请输入用户名"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>
            邮箱
          </Text>
          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>
            手机号
          </Text>
          <Input
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 11))}
            placeholder="11 位手机号"
            keyboardType="number-pad"
            style={styles.input}
          />
          <Text style={[styles.hint, { color: c.warning ?? '#D97706', marginTop: spacing.xs }]}>
            请绑定与后续实人认证一致的手机号，注册后更换需间隔 60 天。
          </Text>

          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>
            密码
          </Text>
          <View style={styles.passwordRow}>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={`至少 ${policy.min_length || 8} 位，含大小写字母、数字与特殊字符`}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={styles.passwordInput}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              {showPassword ? (
                <Eye size={20} stroke={c.textSecondary} />
              ) : (
                <EyeOff size={20} stroke={c.textSecondary} />
              )}
            </Pressable>
          </View>
          {password.length > 0 && (
            <View style={styles.strengthList}>
              {strength.required.map((k) => {
                const ok = strength.checks[k];
                return (
                  <View key={k} style={styles.strengthItem}>
                    {ok ? (
                      <Check size={14} stroke="#16A34A" />
                    ) : (
                      <X size={14} stroke={c.textMuted} />
                    )}
                    <Text
                      style={[
                        styles.strengthText,
                        { color: ok ? '#16A34A' : c.textMuted },
                      ]}
                    >
                      {strengthLabel[k] ?? k}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>
            确认密码
          </Text>
          <Input
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="请再次输入密码"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            style={styles.input}
          />
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text style={[styles.hint, { color: c.error, marginTop: spacing.xs }]}>
              两次输入的密码不一致
            </Text>
          )}

          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>
            邮箱验证码
          </Text>
          <View style={styles.codeRow}>
            <Input
              value={emailCode}
              onChangeText={(t) => setEmailCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 位验证码"
              keyboardType="number-pad"
              style={styles.codeInput}
            />
            <Button
              label={emailCountdown.running ? `${emailCountdown.countdown}s` : '发送'}
              onPress={() => openCaptcha('email')}
              loading={sendingEmail}
              disabled={emailCountdown.running || sendingEmail}
              variant="secondary"
              style={styles.codeBtn}
            />
          </View>

          <Text style={[styles.label, { color: c.textSecondary, marginTop: spacing.md }]}>
            手机验证码
          </Text>
          <View style={styles.codeRow}>
            <Input
              value={smsCode}
              onChangeText={(t) => setSmsCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 位验证码"
              keyboardType="number-pad"
              style={styles.codeInput}
            />
            <Button
              label={smsCountdown.running ? `${smsCountdown.countdown}s` : '发送'}
              onPress={() => openCaptcha('sms')}
              loading={sendingSms}
              disabled={smsCountdown.running || sendingSms}
              variant="secondary"
              style={styles.codeBtn}
            />
          </View>

          <Pressable
            onPress={() => setAgreed(!agreed)}
            style={styles.agreeRow}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: agreed ? c.primary : c.border, backgroundColor: agreed ? c.primary : 'transparent' },
              ]}
            >
              {agreed && <Check size={14} stroke="#FFFFFF" />}
            </View>
            <Text style={[styles.agreeText, { color: c.textSecondary }]}>
              我已年满 18 周岁，并已阅读并同意《用户协议》与《隐私政策》
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push('/legal')} style={{ marginTop: spacing.xs }}>
            <Text style={[styles.link, { color: c.primary }]}>查看《用户协议》与《隐私政策》</Text>
          </Pressable>
        </Card>

        <Button label="注册" onPress={handleRegister} loading={submitting} />
        <Pressable
          onPress={() => router.replace('/(onboarding)/login')}
          style={{ alignSelf: 'center' }}
        >
          <Text style={[styles.link, { color: c.primary }]}>已有账号？去登录</Text>
        </Pressable>
      </ScrollView>

      <GeetestCaptcha
        visible={captchaVisible}
        onClose={() => setCaptchaVisible(false)}
        onSuccess={handleCaptchaSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.title, textAlign: 'center', marginTop: spacing.xl },
  form: { gap: spacing.sm },
  label: { ...typography.caption },
  hint: { ...typography.caption, lineHeight: 18 },
  input: { marginTop: spacing.xs },
  passwordRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  passwordInput: { flex: 1, marginTop: 0 },
  eyeBtn: { padding: spacing.sm },
  strengthList: { marginTop: spacing.sm, gap: 4 },
  strengthItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  strengthText: { ...typography.caption },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  codeInput: { flex: 1, marginTop: 0 },
  codeBtn: { minHeight: 48 },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  agreeText: { ...typography.caption, flex: 1, lineHeight: 20 },
  link: { ...typography.body, fontWeight: '500' },
});
