import { AppShell } from "@/components/app-shell";
import { SwRegister } from "@/components/sw-register";

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SwRegister />
      <AppShell>{children}</AppShell>
    </>
  );
}
