import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

/** Vuelve a cargar los datos al regresar a la pantalla (no en el primer montaje). */
export function useRefreshOnFocus(reload: () => void) {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
      // Solo debe suscribirse una vez; `reload` cambia en cada render
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}
