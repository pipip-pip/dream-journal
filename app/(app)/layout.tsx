// Layout for every signed-in screen: background particles, content, bottom tabs.
import Nav from "@/components/Nav";
import Particles from "@/components/Particles";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Particles />
      <main className="shell">{children}</main>
      <Nav />
    </>
  );
}
