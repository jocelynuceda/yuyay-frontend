import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Vuelve a cargar los datos al regresar a la pantalla (no en el primer montaje) y al volver la app
 * desde segundo plano con la pantalla a la vista: el permiso pudo cambiar mientras tanto.
 */
export function useRefreshOnFocus(reload: () => void) {
  const firstFocus = useRef(true);
  const latest = useRef(reload);
  useLayoutEffect(() => {
    latest.current = reload;
  });
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else latest.current();

      // 'inactive' (Face ID, permisos del sistema) no cuenta como haber salido de la app
      let wasInBackground = false;
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'background') wasInBackground = true;
        else if (state === 'active' && wasInBackground) {
          wasInBackground = false;
          latest.current();
        }
      });
      return () => subscription.remove();
    }, []),
  );
}
