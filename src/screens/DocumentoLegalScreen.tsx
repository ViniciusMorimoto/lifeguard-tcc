import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import BackHeader from '../components/BackHeader';
import InlineNotice from '../components/InlineNotice';
import { colors, fonts } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'DocumentoLegal'>;

const documents = {
  termos: {
    title: 'Termos de Uso',
    intro: 'Regras para utilizar o LifeGuard durante a fase de desenvolvimento acadêmico.',
    sections: [
      ['Finalidade', 'O LifeGuard auxilia pacientes e cuidadores no acompanhamento de informações de saúde, contatos e alertas. Nesta versão, o aplicativo é um protótipo acadêmico em desenvolvimento.'],
      ['Uso responsável', 'As informações e alertas não substituem avaliação, diagnóstico ou atendimento médico. Em uma emergência, procure o serviço de saúde adequado ou ligue para o SAMU pelo número 192.'],
      ['Conta e acesso', 'Você é responsável por informar dados corretos, proteger sua senha e utilizar apenas contas e vínculos autorizados. Não compartilhe códigos de acesso com pessoas desconhecidas.'],
      ['Sensores e disponibilidade', 'Leituras podem atrasar, ficar indisponíveis ou apresentar imprecisões por conexão, bateria, posicionamento ou limitações do sensor. O aplicativo não garante monitoramento ininterrupto.'],
      ['Alterações', 'Os recursos e estes termos podem mudar durante o desenvolvimento. Uma versão definitiva deverá ser revisada antes da publicação comercial do aplicativo.'],
    ],
  },
  privacidade: {
    title: 'Política de Privacidade',
    intro: 'Resumo de como os dados são usados no protótipo LifeGuard.',
    sections: [
      ['Dados tratados', 'O aplicativo pode armazenar nome, e-mail, telefone, foto, gênero, informações importantes do paciente, vínculos de cuidado, limites, leituras e alertas.'],
      ['Como os dados são usados', 'Os dados permitem autenticar a conta, exibir o perfil, conectar pacientes e cuidadores e apresentar o histórico de monitoramento.'],
      ['Compartilhamento no cuidado', 'As informações do paciente ficam disponíveis para os cuidadores autorizados por meio do código de vínculo. O vínculo pode ser removido pelo paciente ou pelo cuidador.'],
      ['Armazenamento e segurança', 'A comunicação com a API usa HTTPS e a sessão é protegida no aparelho. Como o projeto ainda está em desenvolvimento, não devem ser inseridos dados médicos reais ou sensíveis sem autorização.'],
      ['Controle dos dados', 'O usuário pode editar informações do perfil, remover vínculos, exportar uma cópia dos próprios dados e excluir sua conta pelo aplicativo. Os prazos definitivos de retenção serão definidos antes da publicação pública.'],
    ],
  },
} as const;

export default function DocumentoLegalScreen({ navigation, route }: Props) {
  const document = documents[route.params.tipo];
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackHeader title={document.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>TRANSPARÊNCIA LIFEGUARD</Text>
        <Text style={styles.title}>{document.title}</Text>
        <Text style={styles.updated}>Versão de 1º de setembro de 2026</Text>
        <Text style={styles.intro}>{document.intro}</Text>
        <InlineNotice tone="warning" message="Documento provisório para demonstração acadêmica. Deve passar por revisão jurídica e de proteção de dados antes do lançamento público." />
        <View style={styles.rule} />
        {document.sections.map(([title, body], index) => (
          <View key={title} style={styles.section}>
            <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  container: { paddingHorizontal: 20, paddingBottom: 44 },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.6, color: colors.coral, marginTop: 10 },
  title: { fontFamily: fonts.display, fontSize: 31, color: colors.ink, marginTop: 7 },
  updated: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 5 },
  intro: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.ink, marginTop: 18, marginBottom: 18 },
  rule: { height: 3, width: 54, backgroundColor: colors.coral, borderRadius: 2, marginVertical: 22 },
  section: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  number: { width: 26, fontFamily: fonts.display, fontSize: 15, color: colors.coral },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginBottom: 5 },
  body: { fontFamily: fonts.longText, fontSize: 15, lineHeight: 23, color: colors.textSecondary },
});
