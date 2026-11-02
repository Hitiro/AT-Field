import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextStore = {
  requestId: string;
  tenantId?: string;
  // Reservado para o passo do Firebase Auth.
  userId?: string;
  // Usados nos logs de erro (errorLogFields), não em toda linha.
  method?: string;
  // Caminho sem query string nem fragmento.
  path?: string;
  // Padrão da rota (ex.: /users/:id) e handler (ex.: UsersController.findOne),
  // gravados pelo RequestContextGuard quando a rota existe.
  route?: string;
  handler?: string;
  // performance.now() na entrada da requisição.
  startedAt?: number;
};

// Campos que o AppLogger põe em toda linha de log da requisição.
export const IDENTITY_FIELDS = ['requestId', 'tenantId', 'userId'] as const;

const storage = new AsyncLocalStorage<RequestContextStore>();

// Contexto da requisição (requestId, tenantId, rota) disponível em qualquer
// ponto do código chamado por ela, inclusive nos logs (AppLogger).
export const requestContext = {
  run<T>(store: RequestContextStore, callback: () => T): T {
    return storage.run(store, callback);
  },

  get(): RequestContextStore | undefined {
    return storage.getStore();
  },

  // Fora de uma requisição não faz nada.
  setTenantId(tenantId: string) {
    const store = storage.getStore();
    if (store) store.tenantId = tenantId;
  },

  // Fora de uma requisição não faz nada.
  setHandler(route: string | undefined, handler: string) {
    const store = storage.getStore();
    if (!store) return;
    store.route = route;
    store.handler = handler;
  },
};
