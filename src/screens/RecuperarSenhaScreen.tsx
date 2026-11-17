import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/theme';
import BackHeader from '../components/BackHeader';
import AppTextInput from '../components/AppTextInput';
import AppButton from '../components/AppButton';
import InlineNotice from '../components/InlineNotice';
import PasswordRequirements from '../components/PasswordRequirements';
import { apiRequest, ApiError } from '../services/api';
import { isStrongPassword, isValidEmail, passwordValidationMessage } from '../utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'RecuperarSenha'>;
type Step = 'email' | 'code' | 'success';

export default function RecuperarSenhaScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestCode() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setError('Digite um e-mail válido.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<{ mensagem: string }>('/auth/senha/recuperacao/solicitar', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      setEmail(normalizedEmail);
      setStep('code');
      if (step === 'code') Alert.alert('Solicitação recebida', response.mensagem);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível enviar as instruções agora.');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!/^\d{6}$/.test(code)) {
      setError('Informe o código de 6 dígitos enviado por e-mail.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError(passwordValidationMessage(password) ?? 'Escolha uma senha mais segura.');
      return;
    }
    if (password !== passwordConfirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiRequest('/auth/senha/recuperacao/confirmar', {
        method: 'POST',
        body: JSON.stringify({ email, codigo: code, novaSenha: password }),
      });
      setStep('success');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Não foi possível alterar a senha agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Recuperar senha" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.intro}>
            <Text style={styles.title}>{step === 'success' ? 'Senha alterada' : step === 'code' ? 'Confira seu e-mail' : 'Vamos recuperar seu acesso'}</Text>
            <Text style={styles.description}>
              {step === 'success'
                ? 'Sua nova senha já está pronta para ser usada.'
                : step === 'code'
                  ? `Digite o código enviado para ${email}.`
                  : 'Informe o e-mail cadastrado para receber um código de recuperação.'}
            </Text>
          </View>

          {step === 'success' ? (
            <>
              <InlineNotice tone="success" message="As sessões antigas foram desconectadas para proteger sua conta." />
              <AppButton label="Entrar com a nova senha" icon="login" onPress={() => navigation.navigate('Login')} style={styles.button} />
            </>
          ) : step === 'email' ? (
            <>
              <AppTextInput label="E-mail" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="nome@email.com" returnKeyType="send" onSubmitEditing={() => void requestCode()} editable={!loading} required />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <AppButton label="Enviar código" icon="email-outline" onPress={() => void requestCode()} loading={loading} disabled={loading} />
            </>
          ) : (
            <>
              <InlineNotice message="Por segurança, informamos a mesma resposta mesmo quando um e-mail não está cadastrado." />
              <AppTextInput label="Código de 6 dígitos" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!loading} containerStyle={styles.firstField} required />
              <AppTextInput label="Nova senha" value={password} onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry={!showPassword} rightIcon={showPassword ? 'eye-outline' : 'eye-off-outline'} rightIconLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onRightIconPress={() => setShowPassword((value) => !value)} autoComplete="new-password" maxLength={72} editable={!loading} required />
              <PasswordRequirements password={password} />
              <AppTextInput label="Confirmar nova senha" value={passwordConfirmation} onChangeText={(value) => { setPasswordConfirmation(value); setError(''); }} secureTextEntry={!showPassword} autoComplete="new-password" maxLength={72} editable={!loading} returnKeyType="done" onSubmitEditing={() => void resetPassword()} required />
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <AppButton label="Alterar senha" icon="lock-reset" onPress={() => void resetPassword()} loading={loading} disabled={loading} />
              <AppButton label="Enviar novo código" variant="text" onPress={() => void requestCode()} disabled={loading} />
              <AppButton label="Usar outro e-mail" variant="text" onPress={() => { setStep('email'); setCode(''); setError(''); }} disabled={loading} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40, justifyContent: 'center' },
  intro: { marginBottom: 28 }, title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, textAlign: 'center' },
  description: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.textSecondary, textAlign: 'center', marginTop: 10 },
  error: { fontFamily: fonts.body, color: colors.emberText, marginBottom: 12, fontSize: 14 },
  button: { marginTop: 22 }, firstField: { marginTop: 20 },
});
