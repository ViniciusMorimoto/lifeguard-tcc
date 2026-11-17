import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import * as isoCountries from 'i18n-iso-countries';
import ptLocale from 'i18n-iso-countries/langs/pt.json';
import { colors, fonts, radii } from '../theme/theme';
import { flagForCountry, formatNationalPhone } from '../utils/phone';

type Props = {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  helperText?: string;
};

isoCountries.registerLocale(ptLocale);

function countryName(code: CountryCode) {
  return isoCountries.getName(code, 'pt', { select: 'official' }) ?? code;
}

const countries = getCountries().map((code) => ({
  code,
  name: countryName(code),
  callingCode: getCountryCallingCode(code),
})).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function CountryPhoneInput({ country, onCountryChange, value, onChangeText, disabled, error, required = true, helperText }: Props) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const callingCode = getCountryCallingCode(country);
  const filtered = useMemo(() => {
    const term = normalizeSearch(search.trim());
    if (!term) return countries;
    return countries.filter((item) => normalizeSearch(`${item.name} ${item.code} +${item.callingCode}`).includes(term));
  }, [search]);

  function select(code: CountryCode) {
    onCountryChange(code);
    onChangeText(formatNationalPhone(value, code));
    setVisible(false);
    setSearch('');
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Telefone {required ? <Text style={styles.required}>*</Text> : null}</Text>
      <View style={[styles.shell, error && styles.shellError, disabled && styles.disabled]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Selecionar país. Atual: ${countryName(country)}, código mais ${callingCode}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setVisible(true)} style={styles.countryButton}>
          <Text style={styles.flag}>{flagForCountry(country)}</Text>
          <Text style={styles.callingCode}>+{callingCode}</Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.divider} />
        <TextInput
          accessibilityLabel="Número de telefone"
          accessibilityHint={error ? `Erro: ${error}` : helperText}
          accessibilityState={{ disabled: Boolean(disabled) }}
          value={value}
          onChangeText={(text) => onChangeText(formatNationalPhone(text, country))}
          editable={!disabled}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="Número com DDD"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.coral}
          style={styles.input}
        />
      </View>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : <Text style={styles.helper}>{helperText ?? 'Selecione o país; o código internacional será salvo automaticamente.'}</Text>}

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>Selecionar país</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar seleção de país" onPress={() => setVisible(false)} style={styles.closeButton}>
              <MaterialCommunityIcons accessible={false} name="close" size={25} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.searchShell}>
            <MaterialCommunityIcons accessible={false} name="magnify" size={21} color={colors.textSecondary} />
            <TextInput accessibilityLabel="Buscar país ou código telefônico" value={search} onChangeText={setSearch} placeholder="Buscar país ou código" placeholderTextColor={colors.textSecondary} autoFocus style={styles.searchInput} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable accessibilityRole="radio" accessibilityLabel={`${item.name}, código mais ${item.callingCode}`} accessibilityState={{ checked: item.code === country }} onPress={() => select(item.code)} style={({ pressed }) => [styles.countryRow, pressed && styles.pressed]}>
                <Text style={styles.rowFlag}>{flagForCountry(item.code)}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.rowCode}>+{item.callingCode}</Text>
                {item.code === country ? <MaterialCommunityIcons accessible={false} name="check" size={21} color={colors.coral} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textPrimary, marginBottom: 7 },
  required: { color: colors.ember },
  shell: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.cardBg, overflow: 'hidden' },
  shellError: { borderColor: colors.ember },
  disabled: { opacity: 0.55 },
  countryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12 },
  flag: { fontSize: 22 },
  callingCode: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  divider: { width: 1, height: 30, backgroundColor: colors.border },
  input: { flex: 1, minHeight: 51, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 16, color: colors.textPrimary },
  helper: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.emberText, marginTop: 6 },
  modalSafe: { flex: 1, backgroundColor: colors.sand },
  modalHeader: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  modalTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.ink },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  searchShell: { marginHorizontal: 20, marginBottom: 10, minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radii.md, backgroundColor: colors.cardBg, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 48, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  countryRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowFlag: { fontSize: 24 },
  countryName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  rowCode: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.textSecondary },
  pressed: { backgroundColor: colors.coralSoft },
});
