import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/** Devuelve `show(message)` para avisar que una acción salió bien. */
export const useToast = () => useContext(ToastContext);
