import { AppShell } from "@/components/app-shell";
import { ThemeStyle } from "@/components/theme-style";
import { getTheme } from "@/lib/queries";
import { themeCss } from "@/lib/theme";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const css = themeCss(await getTheme());
  return (
    <>
      <ThemeStyle css={css} />
      <AppShell>{children}</AppShell>
    </>
  );
}
