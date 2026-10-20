import { AppShell } from "@/components/app-shell";
import { ThemeStyle } from "@/components/theme-style";
import { db } from "@/lib/db";
import { getTheme } from "@/lib/queries";
import { themeCss } from "@/lib/theme";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const [theme, unreadSpv] = await Promise.all([
    getTheme(),
    db.spvMessage.count({ where: { readAt: null } }),
  ]);
  return (
    <>
      <ThemeStyle css={themeCss(theme)} />
      <AppShell badges={{ "/anaf": unreadSpv }}>{children}</AppShell>
    </>
  );
}
