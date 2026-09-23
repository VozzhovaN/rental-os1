import { SettingsNav } from "@/components/crm/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <SettingsNav />
      {children}
    </div>
  );
}
