import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/theme';
import AppTextInput from '../components/AppTextInput';
import AppButton from '../components/AppButton';
import SegmentedToggle from '../components/SegmentedToggle';
import BackHeader from '../components/BackHeader';
import InlineNotice from '../components/InlineNotice';
import { apiRequest, ApiError } from '../services/api';
import { useAuthStore, type Gender } from '../store/authStore';
import CountryPhoneInput from '../components/CountryPhoneInput';
import GenderSelector from '../components/GenderSelector';
import { normalizePhone } from '../utils/phone';
import type { CountryCode } from 'libphonenumber-js';
import PasswordRequirements from '../components/PasswordRequirements';
import ConsentCheckbox from '../components/ConsentCheckbox';
import { isStrongPassword, isValidEmail, passwordValidationMessage } from '../utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Cadastro'>;

export default function CadastroScreen({ navigation, route }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [pais, setPais] = useState<CountryCode>('BR');
  const [genero, setGenero] = useState<Gender | null>(null);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [tipoConta, setTipoConta] = useState<'idoso' | 'cuidador'>(route.params?.tipoConta ?? 'idoso');
  const [aceitouDocumentos, setAceitouDocumentos] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function handleCadastro() {
    if (!nome.trim() || !email.trim() || !telefone.trim() || !genero || !senha || !confirmarSenha) {
      setErro('Preencha todos os campos.');
      return;
    }
    if (!isValidEmail(email)) {
      setErro('Digite um e-mail válido.');
      return;
    }
    const telefoneInternacional = normalizePhone(telefone, pais);
    if (!telefoneInternacional) {
      setErro('Digite um telefone válido para o país selecionado.');
      return;
    }
    if (!isStrongPassword(senha)) {
      setErro(passwordValidationMessage(senha) ?? 'Escolha uma senha mais segura.');
      return;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (!aceitouDocumentos) {
      setConsentError(true);
      setErro('Leia e aceite os Termos de Uso e a Política de Privacidade para criar a conta.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest<{ token: string; usuario: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>; emailConfirmacaoEnviado: boolean }>('/auth/cadastro', {
        method: 'POST',
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          telefone: telefoneInternacional,
          genero,
          senha,
          tipo: tipoConta,
          aceitouTermos: true,
          aceitouPrivacidade: true,
        }),
      });
      setSession(response.token, response.usuario);
      setErro('');
      Alert.alert(
        'Conta criada',
        response.emailConfirmacaoEnviado
          ? 'Seu cadastro foi concluído. Enviamos um código para confirmar seu e-mail; você pode informá-lo em Conta e segurança.'
          : 'Seu cadastro foi concluído. Você poderá solicitar a confirmação do e-mail em Conta e segurança.',
      );
      navigation.reset({ index: 0, routes: [{ name: tipoConta === 'idoso' ? 'HomeIdoso' : 'HomeCuidador' }] });
    } catch (error) {
      setErro(error instanceof ApiError ? error.message : 'Não foi possível criar sua conta agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <BackHeader title="Criar conta" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.intro}>
          <View style={styles.introLine} />
          <View style={styles.introCopy}>
            <Text style={styles.kicker}>COMECE SUA REDE DE CUIDADO</Text>
            <Text style={styles.titulo}>Sua conta LifeGuard</Text>
            <Text style={styles.tagline}>Escolha como você usa o aplicativo e preencha seus dados.</Text>
          </View>
        </View>

        <SegmentedToggle
          value={tipoConta}
          onChange={setTipoConta}
          disabled={loading}
          options={[
            { value: 'idoso', label: 'Paciente' },
            { value: 'cuidador', label: 'Cuidador' },
          ]}
        />

        <InlineNotice message={tipoConta === 'idoso' ? 'Você poderá acompanhar seus sinais e compartilhar o cuidado com pessoas de confiança.' : 'Você poderá acompanhar pacientes vinculados e configurar os limites de alerta.'} />

        <View style={styles.fields}>
          <AppTextInput label="Nome completo" value={nome} onChangeText={(value) => { setNome(value); setErro(''); }} editable={!loading} placeholder="Seu nome completo" autoComplete="name" maxLength={100} required />
          <GenderSelector value={genero} onChange={(value) => { setGenero(value); setErro(''); }} disabled={loading} required />
          <AppTextInput label="E-mail" value={email} onChangeText={(value) => { setEmail(value); setErro(''); }} editable={!loading} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="nome@email.com" maxLength={254} required />
          <CountryPhoneInput country={pais} onCountryChange={(value) => { setPais(value); setErro(''); }} value={telefone} onChangeText={(value) => { setTelefone(value); setErro(''); }} disabled={loading} />
          <AppTextInput
            label="Senha"
            value={senha}
            onChangeText={(value) => { setSenha(value); setErro(''); }}
            editable={!loading}
            secureTextEntry={!mostrarSenha}
            rightIcon={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
            rightIconLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            onRightIconPress={() => setMostrarSenha((value) => !value)}
            autoComplete="new-password"
            maxLength={72}
            placeholder="Pelo menos 8 caracteres"
            required
          />
          <PasswordRequirements password={senha} />
          <AppTextInput
            label="Confirmar senha"
            value={confirmarSenha}
            onChangeText={(value) => { setConfirmarSenha(value); setErro(''); }}
            editable={!loading}
            secureTextEntry={!mostrarConfirmacao}
            rightIcon={mostrarConfirmacao ? 'eye-outline' : 'eye-off-outline'}
            rightIconLabel={mostrarConfirmacao ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
            onRightIconPress={() => setMostrarConfirmacao((value) => !value)}
            placeholder="Repita sua senha"
            maxLength={72}
            returnKeyType="done"
            onSubmitEditing={handleCadastro}
            required
          />
        </View>

        <ConsentCheckbox
          checked={aceitouDocumentos}
          disabled={loading}
          error={consentError}
          onChange={(checked) => { setAceitouDocumentos(checked); setConsentError(false); setErro(''); }}
          onTermsPress={() => navigation.navigate('DocumentoLegal', { tipo: 'termos' })}
          onPrivacyPress={() => navigation.navigate('DocumentoLegal', { tipo: 'privacidade' })}
        />

        {erro ? <Text accessibilityRole="alert" style={styles.erro}>{erro}</Text> : null}

        <AppButton label="Criar minha conta" icon="account-plus-outline" onPress={handleCadastro} loading={loading} />
        <AppButton label="Já tenho conta" variant="text" onPress={() => navigation.navigate('Login', { tipoConta })} disabled={loading} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },
  intro: { flexDirection: 'row', gap: 14, marginTop: 8, marginBottom: 24 },
  introLine: { width: 4, borderRadius: 2, backgroundColor: colors.coral },
  introCopy: { flex: 1 },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.3, color: colors.coral, marginBottom: 5 },
  titulo: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  tagline: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.textSecondary, marginTop: 5 },
  fields: { marginTop: 20 },
  erro: { fontFamily: fonts.body, color: colors.emberText, marginBottom: 12, fontSize: 14 },
});
