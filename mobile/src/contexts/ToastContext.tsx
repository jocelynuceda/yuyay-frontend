import { createContext, useCallback, useReducer, type ReactNode } from 'react';
import { Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Toast = { id: number; message: string };
type Action = { type: 'show'; message: string } | { type: 'hide'; id: number };

/** Cola de avisos: se muestran de a uno, en el orden en que llegaron. */
export function toastReducer(queue: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'show':
      return [...queue, { id: (queue.at(-1)?.id ?? 0) + 1, message: action.message }];
    case 'hide':
      return queue.filter((toast) => toast.id !== action.id);
  }
}

export const ToastContext = createContext<(message: string) => void>(() => {});

/** Aviso breve de que una acción salió bien (guardar, borrar, enviar). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, dispatch] = useReducer(toastReducer, []);
  const show = useCallback((message: string) => dispatch({ type: 'show', message }), []);
  const insets = useSafeAreaInsets();
  const current = queue[0];

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        key={current?.id}
        visible={current !== undefined}
        onDismiss={() => current && dispatch({ type: 'hide', id: current.id })}
        duration={4000}
        // Por encima de la barra de pestañas flotante y de las pantallas
        wrapperStyle={{ bottom: insets.bottom + 80, zIndex: 1000, elevation: 1000 }}
      >
        {current?.message ?? ''}
      </Snackbar>
    </ToastContext.Provider>
  );
}
