import { useSyncExternalStore } from 'react'
import { useColorScheme as useRNColorScheme } from 'react-native'

const noopSubscribe = () => () => {}

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * The server snapshot is `false` (renders 'light'); the client snapshot is `true` after hydration.
 */
export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const colorScheme = useRNColorScheme()

  return hasHydrated ? colorScheme : 'light'
}
