type ToastType = 'success' | 'error';
type ToastListener = (message: string, type: ToastType) => void;

let _listener: ToastListener | null = null;

export function setToastListener(fn: ToastListener | null) {
  _listener = fn;
}

export function toast(message: string, type: ToastType = 'success') {
  _listener?.(message, type);
}
