export function usePathname() { return window.location.pathname; }
export function useSearchParams() { return new URL(window.location.href).searchParams; }
export function useRouter() {
  return {
    refresh() { window.dispatchEvent(new Event('preview-refresh')); },
    push(url) { window.history.pushState({}, '', url); window.dispatchEvent(new Event('preview-refresh')); },
    replace(url) { window.history.replaceState({}, '', url); window.dispatchEvent(new Event('preview-refresh')); },
  };
}
