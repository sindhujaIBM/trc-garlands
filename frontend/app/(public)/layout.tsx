import { ChatWidget } from "@/components/chat/ChatWidget";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  );
}
