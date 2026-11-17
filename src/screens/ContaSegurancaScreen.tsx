import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import BackHeader from '../components/BackHeader';
import Card from '../components/Card';
import AppTextInput from '../components/AppTextInput';
import AppButton from '../components/AppButton';
import PasswordRequirements from '../components/PasswordRequirements';
import InlineNotice from '../components/InlineNotice';
import { apiRequest, ApiError } from '../services/api';
import { isStrongPassword, passwordValidationMessage } from '../utils/validation';
import { useAuthStore } from '../store/authStore';
import { useMonitoringStore } from '../store/monitoringStore';
import { getStoredPushToken, unregisterPushNotifications } from '../services/notifications';
import { colors, fonts } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ContaSeguranca'>;

export default function ContaSegurancaScreen({ navigation }: Props) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const rememberSession = useAuthStore((state) => state.rememberSession);
  const setSession = useAuthStore((state) => state.setSession);
  const updateUser = useAuthStore((state) => state.updateUser);
  const resetMonitoring = useMonitoringStore((state) => state.reset);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [confirmingVerification, setConfirmingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState('');

  const loadSessionCount = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    setSessionError('');
    try {
      const [sessionsResponse, emailResponse] = await Promise.all([
        apiRequest<{ quantidade: number; token?: string }>('/auth/sessoes/resumo'),
        apiRequest<{ emailVerificado: boolean }>('/auth/email/status'),
      ]);
      setSessionCount(sessionsResponse.quantidade);
      if (sessionsResponse.token) setSession(sessionsResponse.token, user, rememberSession);
      if (emailResponse.emailVerificado !== user.emailVerificado) updateUser({ emailVerificado: emailResponse.emailVerificado });
    } catch (error) {
      setSessionError(error instanceof ApiError ? error.message : 'Não foi possível consultar os dispositivos conectados.');
    } finally {
      setLoadingSessions(false);
    }
  }, [rememberSession, setSession, updateUser, user]);

  useFocusEffect(useCallback(() => {
    void loadSessionCount();
  }, [loadSessionCount]));

  async function sendVerificationCode() {
    setSendingVerification(true);
    setVerificationError('');
    try {
      const response = await apiRequest<{ emailVerificado: boolean }>('/auth/email/confirmacao/solicitar', { method: 'POST' });
      if (response.emailVerificado) {
        updateUser({ emailVerificado: true });
        Alert.alert('E-mail confirmado', 'Este endereço já estava confirmado.');
        return;
      }
      Alert.alert('Código enviado', `Confira a caixa de entrada e o spam de ${user?.email ?? 'seu e-mail'}.`);
    } catch (error) {
      setVerificationError(error instanceof ApiError ? error.message : 'Não foi possível enviar o código de confirmação.');
    } finally {
      setSendingVerification(false);
    }
  }

  async function confirmEmail() {
    if (!/^\d{6}$/.test(verificationCode)) {
      setVerificationError('Informe o código de 6 dígitos enviado por e-mail.');
      return;
    }
    setConfirmingVerification(true);
    setVerificationError('');
    try {
      await apiRequest('/auth/email/confirmacao/confirmar', {
        method: 'POST',
        body: JSON.stringify({ codigo: verificationCode }),
      });
      updateUser({ emailVerificado: true });
      setVerificationCode('');
      Alert.alert('E-mail confirmado', 'Seu endereço de e-mail foi confirmado com sucesso.');
    } catch (error) {
      setVerificationError(error instanceof ApiError ? error.message : 'Não foi possível confirmar o e-mail.');
    } finally {
      setConfirmingVerification(false);
    }
  }

  function confirmRevokeOtherSessions() {
    Alert.alert(
      'Desconectar outros dispositivos?',
      'Todos os outros celulares e computadores precisarão entrar novamente. Este aparelho continuará conectado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desconectar', style: 'destructive', onPress: () => void revokeOtherSessions() },
      ],
    );
  }

  async function revokeOtherSessions() {
    if (!user) return;
    setRevokingSessions(true);
    setSessionError('');
    try {
      const currentPushToken = await getStoredPushToken().catch(() => null);
      const response = await apiRequest<{ token: string; quantidade: number; mensagem: string }>('/auth/sessoes/revogar-outras', {
        method: 'POST',
        body: JSON.stringify({ tokenPushAtual: currentPushToken }),
      });
      setSession(response.token, user, rememberSession);
      setSessionCount(response.quantidade);
      Alert.alert('Outros dispositivos desconectados', 'Somente este aparelho continua com acesso à sua conta.');
    } catch (error) {
      setSessionError(error instanceof ApiError ? error.message : 'Não foi possível desconectar os outros dispositivos.');
    } finally {
      setRevokingSessions(false);
    }
  }

  async function changePassword() {
    if (!senhaAtual) { setPasswordError('Informe sua senha atual.'); return; }
    if (!isStrongPassword(novaSenha)) { setPasswordError(passwordValidationMessage(novaSenha) ?? 'Escolha uma senha mais segura.'); return; }
    if (novaSenha !== confirmarSenha) { setPasswordError('A confirmação não corresponde à nova senha.'); return; }
    setChangingPassword(true); setPasswordError('');
    try {
      await apiRequest('/auth/senha', { method: 'PATCH', body: JSON.stringify({ senhaAtual, novaSenha }) });
      setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
      Alert.alert('Senha alterada', 'Sua nova senha já pode ser usada nos próximos acessos.');
    } catch (error) {
      setPasswordError(error instanceof ApiError ? error.message : 'Não foi possível alterar sua senha.');
    } finally { setChangingPassword(false); }
  }

  async function exportAccountData() {
    setExportingData(true);
    setExportError('');
    try {
      const report = await apiRequest<Record<string, unknown>>('/auth/me/exportacao');
      if (!(await Sharing.isAvailableAsync())) {
        setExportError('O compartilhamento de arquivos não está disponível neste dispositivo.');
        return;
      }
      const file = new File(Paths.cache, 'lifeguard-meus-dados.json');
      file.create({ overwrite: true });
      file.write(JSON.stringify(report, null, 2));
      await Sharing.shareAsync(file.uri, {
        dialogTitle: 'Compartilhar meus dados do LifeGuard',
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } catch (error) {
      setExportError(error instanceof ApiError ? error.message : 'Não foi possível gerar ou compartilhar seus dados.');
    } finally {
      setExportingData(false);
    }
  }

  function confirmDelete() {
    if (!senhaExclusao) { setDeleteError('Informe sua senha atual.'); return; }
    if (confirmacaoExclusao.trim().toUpperCase() !== 'EXCLUIR') { setDeleteError('Digite EXCLUIR para confirmar.'); return; }
    Alert.alert(
      'Excluir conta definitivamente?',
      'O perfil, os vínculos e os dados associados serão removidos. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir conta', style: 'destructive', onPress: () => void deleteAccount() },
      ],
    );
  }

  async function deleteAccount() {
    setDeleting(true); setDeleteError('');
    try {
      await apiRequest('/auth/me', { method: 'DELETE', body: JSON.stringify({ senha: senhaExclusao }) });
      await unregisterPushNotifications().catch(() => undefined);
      logout(); resetMonitoring();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      Alert.alert('Conta excluída', 'Seus dados foram removidos do LifeGuard.');
    } catch (error) {
      setDeleteError(error instanceof ApiError ? error.message : 'Não foi possível excluir sua conta.');
    } finally { setDeleting(false); }
  }

  const busy = changingPassword || deleting || revokingSessions || sendingVerification || confirmingVerification || exportingData;
  const passwordIcon = mostrarSenhas ? 'eye-outline' : 'eye-off-outline';
  const passwordIconLabel = mostrarSenhas ? 'Ocultar senhas' : 'Mostrar senhas';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Conta e segurança" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.sectionTitle}>Confirmação de e-mail</Text>
          <Text style={styles.helper}>Confirme seu endereço para recuperar o acesso à conta com segurança.</Text>
          <Card style={styles.card}>
            {user?.emailVerificado ? (
              <InlineNotice tone="success" message={`E-mail confirmado: ${user.email}`} />
            ) : (
              <>
                <InlineNotice tone="warning" message={`O e-mail ${user?.email ?? ''} ainda não foi confirmado.`} />
                <AppTextInput
                  label="Código de confirmação"
                  value={verificationCode}
                  onChangeText={(value) => { setVerificationCode(value.replace(/\D/g, '').slice(0, 6)); setVerificationError(''); }}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  editable={!busy}
                  maxLength={6}
                  helperText="O código expira em 15 minutos. Se ainda não recebeu, solicite abaixo."
                  containerStyle={styles.verificationField}
                  required
                />
                {verificationError ? <Text accessibilityRole="alert" style={styles.error}>{verificationError}</Text> : null}
                <AppButton label="Confirmar e-mail" icon="email-check-outline" onPress={() => void confirmEmail()} loading={confirmingVerification} disabled={busy} />
                <AppButton label="Enviar novo código" icon="email-outline" variant="secondary" onPress={() => void sendVerificationCode()} loading={sendingVerification} disabled={busy} style={styles.resendButton} />
              </>
            )}
          </Card>

          <Text style={styles.sectionTitle}>Alterar senha</Text>
          <Text style={styles.helper}>Use uma senha exclusiva que você não utiliza em outros serviços.</Text>
          <Card style={styles.card}>
            <AppTextInput label="Senha atual" value={senhaAtual} onChangeText={(value) => { setSenhaAtual(value); setPasswordError(''); }} secureTextEntry={!mostrarSenhas} autoCapitalize="none" autoComplete="current-password" editable={!busy} maxLength={72} rightIcon={passwordIcon} rightIconLabel={passwordIconLabel} onRightIconPress={() => setMostrarSenhas((value) => !value)} required />
            <AppTextInput label="Nova senha" value={novaSenha} onChangeText={(value) => { setNovaSenha(value); setPasswordError(''); }} secureTextEntry={!mostrarSenhas} autoCapitalize="none" autoComplete="new-password" editable={!busy} maxLength={72} rightIcon={passwordIcon} rightIconLabel={passwordIconLabel} onRightIconPress={() => setMostrarSenhas((value) => !value)} required />
            <PasswordRequirements password={novaSenha} />
            <AppTextInput label="Confirmar nova senha" value={confirmarSenha} onChangeText={(value) => { setConfirmarSenha(value); setPasswordError(''); }} secureTextEntry={!mostrarSenhas} autoCapitalize="none" autoComplete="new-password" editable={!busy} maxLength={72} required />
            {passwordError ? <Text accessibilityRole="alert" style={styles.error}>{passwordError}</Text> : null}
            <AppButton label="Alterar senha" icon="lock-reset" onPress={() => void changePassword()} loading={changingPassword} disabled={busy} />
          </Card>

          <Text style={styles.sectionTitle}>Dispositivos conectados</Text>
          <Text style={styles.helper}>Encerre o acesso em outros aparelhos caso tenha perdido um celular ou usado sua conta em um dispositivo compartilhado.</Text>
          <Card style={styles.card}>
            <Text accessibilityLiveRegion="polite" style={styles.sessionCount}>
              {loadingSessions || sessionCount === null
                ? 'Consultando dispositivos logados...'
                : `Dispositivos logados nesta conta: ${sessionCount}`}
            </Text>
            <InlineNotice message="Este aparelho permanecerá conectado. Os demais precisarão informar e-mail e senha novamente." />
            {sessionError ? <Text accessibilityRole="alert" style={styles.error}>{sessionError}</Text> : null}
            <AppButton label="Desconectar outros dispositivos" icon="logout-variant" variant="secondary" onPress={confirmRevokeOtherSessions} loading={revokingSessions} disabled={busy || loadingSessions || sessionCount === null || sessionCount <= 1} />
          </Card>

          <Text style={styles.sectionTitle}>Privacidade e seus dados</Text>
          <Text style={styles.helper}>Gere um arquivo JSON com as informações associadas à sua conta para salvar ou compartilhar pelo celular.</Text>
          <Card style={styles.card}>
            <InlineNotice message="Por segurança, o relatório nunca inclui senhas, códigos temporários ou tokens de acesso e notificação." />
            {exportError ? <Text accessibilityRole="alert" style={styles.exportError}>{exportError}</Text> : null}
            <AppButton label="Exportar meus dados" icon="download-outline" variant="secondary" onPress={() => void exportAccountData()} loading={exportingData} disabled={busy} style={styles.exportButton} />
          </Card>

          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Excluir conta</Text>
          <Text style={styles.helper}>Esta ação remove definitivamente o perfil e os dados relacionados.</Text>
          <Card style={styles.card}>
            <InlineNotice tone="danger" message="A exclusão é permanente. Vínculos, leituras e alertas associados também podem ser removidos." />
            <AppTextInput label="Senha atual" value={senhaExclusao} onChangeText={(value) => { setSenhaExclusao(value); setDeleteError(''); }} secureTextEntry autoCapitalize="none" autoComplete="current-password" editable={!busy} maxLength={72} containerStyle={styles.firstDeleteField} required />
            <AppTextInput label="Digite EXCLUIR" value={confirmacaoExclusao} onChangeText={(value) => { setConfirmacaoExclusao(value); setDeleteError(''); }} autoCapitalize="characters" autoCorrect={false} editable={!busy} maxLength={7} required />
            {deleteError ? <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text> : null}
            <AppButton label="Excluir minha conta" icon="delete-forever-outline" variant="danger" onPress={confirmDelete} loading={deleting} disabled={busy} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand }, flex: { flex: 1 }, container: { paddingHorizontal: 20, paddingBottom: 44 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 8 },
  dangerTitle: { color: colors.emberText, marginTop: 12 },
  helper: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },
  card: { marginBottom: 22 }, error: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.emberText, marginBottom: 14 },
  sessionCount: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.ink, marginBottom: 14 },
  verificationField: { marginTop: 16 }, resendButton: { marginTop: 10 },
  exportButton: { marginTop: 16 }, exportError: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.emberText, marginTop: 14 },
  firstDeleteField: { marginTop: 16 },
});
