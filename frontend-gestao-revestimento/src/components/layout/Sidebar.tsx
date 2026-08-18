import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Home, FileText, Calculator, LogOut, Settings, Bell, Receipt, Map, Link2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

const navigation = [
  { name: "Início", href: "/", icon: Home },
  { name: "Cadastro", href: "/cadastro", icon: FileText },
  { name: "Calcular", href: "/calcular", icon: Calculator },
  { name: "Orçamento", href: null, icon: Receipt },
  { name: "Mapa Estoque", href: "/mapa-estoque", icon: Map },
] as const

export function Sidebar() {
  const [location] = useLocation()
  const { logout, session } = useAuth()
  const queryClient = useQueryClient()
  const [notifCount] = useState(3)

  const handleLogout = async () => {
    await logout()
    queryClient.clear()
  }

  return (
    <div className="flex h-full w-64 flex-col bg-black">
      {/* Logo */}
      <div className="flex flex-col h-24 shrink-0 justify-center px-6 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          RedeASSO
        </h1>
        <p className="text-sm text-white/70 mt-1">Sistema de Gestão</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href
          if (!item.href) {
            return (
              <button
                key={item.name}
                type="button"
                className="w-full group flex items-center px-6 py-3 text-base font-medium transition-all text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent"
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {item.name}
              </button>
            )
          }
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
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          )
        })}
        {!session?.areaCentralConnected && (
          <Link
            href="/conexao-area-central"
            className={cn(
              "group flex items-center px-6 py-3 text-base font-medium transition-all",
              location === "/conexao-area-central"
                ? "bg-white/20 border-l-4 border-white text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white border-l-4 border-transparent"
            )}
          >
            <Link2 className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            Conectar Área Central
          </Link>
        )}
      </nav>

      {/* Rodapé: Notificações + Configurações + Sair */}
      <div className="border-t border-white/10 mt-auto">
        <button
          onClick={() => {}}
          className="w-full px-6 py-3.5 flex items-center gap-3 text-white/70 hover:bg-white/10 hover:text-white transition-all text-base font-medium"
        >
          <div className="relative">
            <Bell className="h-5 w-5 flex-shrink-0" />
            {notifCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center rounded-full bg-white text-black text-[10px] font-bold leading-none">
                {notifCount}
              </span>
            )}
          </div>
          <span>Notificações</span>
        </button>

        <button
          onClick={() => {}}
          className="w-full px-6 py-3.5 flex items-center gap-3 text-white/70 hover:bg-white/10 hover:text-white transition-all text-base font-medium"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span>Configurações</span>
        </button>

        <button
          onClick={() => void handleLogout()}
          className="w-full px-6 py-3.5 flex items-center gap-3 text-white/70 hover:bg-white/10 hover:text-white transition-all text-base font-medium"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  )
}
