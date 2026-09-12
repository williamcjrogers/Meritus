import type { ComponentProps } from "react";
export function navigate(path: string) {
  if (["/portal/research", "/portal/research/sources", "/portal/research/advanced"].includes(path)) window.dispatchEvent(new CustomEvent("preview-navigate", { detail: path }));
  else window.alert("This local preview uses sample data. On the live site, this opens " + path);
}
export default function Link({ href, onClick, ...props }: ComponentProps<"a">) {
  return <a {...props} href={href} onClick={event => { onClick?.(event); if (href?.startsWith("/portal")) { event.preventDefault(); navigate(href); } }} />;
}
export const useRouter = () => ({ push: navigate });
