import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Home, FileText, Calculator, LogOut } from "lucide-react"

const navigation = [
  { name: "Início", href: "/", icon: Home },
  { name: "Cadastro", href: "/cadastro", icon: FileText },
  { name: "Calcular", href: "/calcular", icon: Calculator },
]

export function Sidebar() {
  const [location] = useLocation()

  return (
    <div className="flex h-full w-64 flex-col bg-[#980000]">
      <div className="flex flex-col h-24 shrink-0 justify-center px-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          RedeASSO
        </h1>
        <p className="text-sm text-white/70 mt-1">Sistema de Gestão</p>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-6 py-3 text-base font-medium transition-all",
                isActive
                  ? "bg-white/20 border-l-4 border-white text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-white/10 mt-auto">
        <button
          onClick={() => {}} 
          className="w-full px-6 py-4 flex items-center gap-3 text-white/70 hover:bg-white/10 hover:text-white transition-all text-base font-medium"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  )
}
