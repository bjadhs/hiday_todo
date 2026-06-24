import { Sidebar } from "@/components/sidebar"
import { StoreHydrator } from "@/components/store-hydrator"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreHydrator>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </StoreHydrator>
  )
}
