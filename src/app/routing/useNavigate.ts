import { useRouter } from './routerContext'

export function useNavigate() {
  return useRouter().navigate
}
