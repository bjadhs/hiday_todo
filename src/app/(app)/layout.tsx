import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { StoreHydrator } from "@/components/store-hydrator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreHydrator>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </StoreHydrator>
  )
}
