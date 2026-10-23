import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '@/hooks/use-theme'

/** Fundo da tela + rolagem + margens de 16 px; conteúdo até 640 px de largura. */
export function Screen({
  children,
  topo = false,
}: {
  children: ReactNode
  /** Sem header: respeita a área segura do topo. */
  topo?: boolean
}) {
  const { cores, espaco } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.bg }}
      contentContainerStyle={{
        paddingHorizontal: espaco[4],
        paddingTop: (topo ? insets.top : 0) + espaco[4],
        paddingBottom: insets.bottom + espaco[8],
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.conteudo}>{children}</View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  conteudo: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16 },
})
