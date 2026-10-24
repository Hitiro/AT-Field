import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Saira_500Medium } from '@expo-google-fonts/saira/500Medium'
import { Saira_600SemiBold } from '@expo-google-fonts/saira/600SemiBold'
import { Saira_700Bold } from '@expo-google-fonts/saira/700Bold'
import { useFonts } from 'expo-font'
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
} from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { fontes } from '@/constants/theme'
import { useTheme } from '@/hooks/use-theme'
import { StoreProvider } from '@/state/store'
import { ThemeProvider } from '@/theme/theme-provider'

SplashScreen.preventAutoHideAsync()

const TITULOS: Record<string, string> = {
  resumo: 'Resumo do mês',
  lancar: 'Lançamento rápido',
  whatsapp: 'Colar do WhatsApp',
  pendencias: 'A revisar',
  'lancamento/[id]': 'Lançamento',
  financeiro: 'Financeiro',
  simular: 'Simulação rápida',
  veiculo: 'Custo do veículo',
  agenda: 'Agenda',
  empresas: 'Empresas',
  'empresa/[id]': 'Empresa',
}

function Navegacao() {
  const { cores, esquema } = useTheme()
  const base = esquema === 'escuro' ? DarkTheme : DefaultTheme
  // Tema de navegação montado dos tokens de papel
  const tema = {
    ...base,
    colors: {
      ...base.colors,
      background: cores.bg,
      card: cores.surface,
      text: cores.textHeading,
      border: cores.border,
      primary: cores.accent,
    },
  }
  return (
    <NavThemeProvider value={tema}>
      <StatusBar style={esquema === 'escuro' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontFamily: fontes.display.semibold },
          headerTintColor: cores.textHeading,
          headerStyle: { backgroundColor: cores.surface },
          contentStyle: { backgroundColor: cores.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {Object.entries(TITULOS).map(([name, title]) => (
          <Stack.Screen key={name} name={name} options={{ title }} />
        ))}
      </Stack>
    </NavThemeProvider>
  )
}

export default function RootLayout() {
  const [carregadas, erro] = useFonts({
    Saira_500Medium,
    Saira_600SemiBold,
    Saira_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  })
  const pronto = carregadas || !!erro

  useEffect(() => {
    // com erro de fonte, segue com a fonte do sistema
    if (pronto) SplashScreen.hideAsync()
  }, [pronto])

  if (!pronto) return null

  return (
    <ThemeProvider>
      <StoreProvider>
        <Navegacao />
      </StoreProvider>
    </ThemeProvider>
  )
}
