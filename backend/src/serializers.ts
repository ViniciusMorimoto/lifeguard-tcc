import type { ElderProfile, User } from './generated/prisma/client.js';
import { Gender, UserType } from './generated/prisma/enums.js';

export function serializeGender(gender?: Gender | null) {
  if (!gender) return null;
  return {
    [Gender.FEMALE]: 'feminino',
    [Gender.MALE]: 'masculino',
    [Gender.NON_BINARY]: 'nao_binario',
    [Gender.OTHER]: 'outro',
    [Gender.PREFER_NOT_TO_SAY]: 'prefiro_nao_informar',
  }[gender];
}

export function serializeElderProfile(profile?: ElderProfile | null) {
  if (!profile) return null;
  return {
    dataNascimento: profile.birthDate?.toISOString().slice(0, 10) ?? null,
    tipoSanguineo: profile.bloodType,
    alergias: profile.allergies,
    medicamentos: profile.medications,
    condicoesMedicas: profile.medicalConditions,
    observacoesImportantes: profile.importantNotes,
    contatoEmergenciaNome: profile.emergencyContactName,
    contatoEmergenciaTelefone: profile.emergencyContactPhone,
  };
}

export function serializeUser(
  user: Pick<User, 'id' | 'name' | 'email' | 'phone' | 'type' | 'profilePhoto' | 'gender' | 'emailVerifiedAt'>,
  elderProfile?: ElderProfile | null,
) {
  return {
    id: user.id,
    nome: user.name,
    email: user.email,
    emailVerificado: Boolean(user.emailVerifiedAt),
    telefone: user.phone,
    foto: user.profilePhoto,
    genero: serializeGender(user.gender),
    tipo: user.type === UserType.ELDER ? 'idoso' : 'cuidador',
    perfilIdoso: user.type === UserType.ELDER ? serializeElderProfile(elderProfile) : null,
  };
}
