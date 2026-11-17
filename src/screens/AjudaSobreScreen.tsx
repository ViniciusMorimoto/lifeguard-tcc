import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import BackHeader from '../components/BackHeader';
import Card from '../components/Card';
import InlineNotice from '../components/InlineNotice';
import { colors, fonts } from '../theme/theme';
import BrandLogo from '../components/BrandLogo';
import { releaseNotes } from '../content/releaseNotes';

type Props = NativeStackScreenProps<RootStackParamList, 'AjudaSobre'>;

const questions = [
  ['O LifeGuard substitui atendimento médico?', 'Não. O aplicativo auxilia no acompanhamento e na comunicação, mas não realiza diagnóstico e não substitui profissionais ou serviços de emergência.'],
  ['Quem pode ver as informações do paciente?', 'O próprio paciente e os cuidadores que ele autorizou por meio de um código de vínculo válido. O vínculo pode ser removido a qualquer momento.'],
  ['O aplicativo funciona sem internet?', 'Ele abre e preserva a sessão, mas cadastro, vínculos, atualização de dados e informações vindas do servidor precisam de conexão.'],
  ['Por que uma notificação pode não chegar?', 'O cuidador precisa estar vinculado, permitir notificações no Android e ter conexão. Modos de economia de bateria também podem atrasar a entrega.'],
  ['Preciso deixar o computador ligado?', 'Não. O APK acessa a API hospedada na Oracle e funciona sem Expo Go, cabo USB ou npm start.'],
] as const;

export default function AjudaSobreScreen({ navigation }: Props) {
  const version = Constants.expoConfig?.version ?? 'não identificada';
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title="Ajuda e sobre" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text accessibilityRole="header" style={styles.title}>Novidades desta atualização</Text>
        <Card style={styles.questionCard}>
          <Text style={styles.question}>{releaseNotes.edition}</Text>
          {releaseNotes.items.map((item) => <Text key={item} style={styles.releaseItem}>• {item}</Text>)}
        </Card>
        <InlineNotice tone="warning" message="Em uma emergência médica, procure atendimento imediatamente ou ligue para o SAMU pelo número 192." />
        <Text accessibilityRole="header" style={styles.title}>Perguntas frequentes</Text>
        {questions.map(([question, answer], index) => (
          <Card key={question} style={styles.questionCard}>
            <View style={styles.questionHeader}><Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text><Text accessibilityRole="header" style={styles.question}>{question}</Text></View>
            <Text style={styles.answer}>{answer}</Text>
          </Card>
        ))}

        <Text accessibilityRole="header" style={styles.title}>Transparência</Text>
        <Card style={styles.linksCard}>
          <LegalLink label="Termos de Uso" icon="file-document-outline" onPress={() => navigation.navigate('DocumentoLegal', { tipo: 'termos' })} />
          <LegalLink label="Política de Privacidade" icon="shield-lock-outline" onPress={() => navigation.navigate('DocumentoLegal', { tipo: 'privacidade' })} last />
        </Card>

        <View style={styles.about}>
          <BrandLogo />
          <Text style={styles.version}>Versão {version}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalLink({ label, icon, onPress, last }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void; last?: boolean }) {
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.link, !last && styles.linkBorder, pressed && styles.pressed]}><MaterialCommunityIcons accessible={false} name={icon} size={22} color={colors.coral} /><Text style={styles.linkLabel}>{label}</Text><MaterialCommunityIcons accessible={false} name="chevron-right" size={24} color={colors.textSecondary} /></Pressable>;
}

const styles = StyleSheet.create({
  releaseItem: { fontFamily: fonts.longText, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 10 },
  safe: { flex: 1, backgroundColor: colors.sand }, container: { paddingHorizontal: 20, paddingBottom: 44 },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginTop: 24, marginBottom: 12 },
  questionCard: { marginBottom: 10 }, questionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  number: { fontFamily: fonts.display, fontSize: 14, color: colors.coral, marginTop: 2 }, question: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.ink },
  answer: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginTop: 9, marginLeft: 28 },
  linksCard: { paddingVertical: 0 }, link: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }, linkBorder: { borderBottomWidth: 1, borderBottomColor: colors.border }, linkLabel: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink }, pressed: { opacity: 0.65 },
  about: { alignItems: 'center', marginTop: 30 }, appName: { fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginTop: 7 }, version: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.coral, marginTop: 3 }, academic: { maxWidth: 310, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: 'center', color: colors.textSecondary, marginTop: 9 },
});
