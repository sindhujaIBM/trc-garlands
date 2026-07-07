export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // TODO: guard with Cognito admin pool (MFA) — redirect to admin sign-in
  // TODO: sidebar nav: Orders · Catalog · Seasonal · Conversations · Media Inbox
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b px-4 py-3 font-semibold text-leaf">
        TRC Admin
      </header>
      {children}
    </div>
  );
}
