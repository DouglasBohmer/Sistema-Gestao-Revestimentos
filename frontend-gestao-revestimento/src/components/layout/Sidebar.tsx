import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home,
  FileText,
  Calculator,
  LogOut,
  Settings,
  Bell,
  Receipt,
  Map,
  Link2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const navigation = [
  { name: "Início", href: "/", icon: Home },
  { name: "Cadastro", href: "/cadastro", icon: FileText },
  { name: "Calcular", href: "/calcular", icon: Calculator },
  { name: "Orçamento", href: null, icon: Receipt },
  { name: "Mapa Estoque", href: "/mapa-estoque", icon: Map },
] as const;

const menuItemClass =
  "flex w-full items-center overflow-hidden border-l-4 px-[18px] py-3 text-base font-medium transition-colors";

const menuLabelClass =
  "ml-3 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover/sidebar:max-w-48 group-hover/sidebar:opacity-100 group-focus-within/sidebar:max-w-48 group-focus-within/sidebar:opacity-100";

export function Sidebar() {
  const [location] = useLocation();
  const { logout, session } = useAuth();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
  };

  return (
    <div className="relative z-50 h-full w-16 shrink-0">
      <aside
        aria-label="Menu principal"
        className="group/sidebar absolute inset-y-0 left-0 flex w-16 flex-col overflow-hidden bg-black transition-[width,box-shadow] duration-300 ease-out motion-reduce:transition-none hover:w-64 hover:shadow-2xl focus-within:w-64 focus-within:shadow-2xl"
      >
        {/* Logo */}
        <div className="flex h-24 shrink-0 items-center border-b border-white/10">
          <div className="flex w-16 shrink-0 items-center justify-center">
            <img
              src="/images/redeasso-logo.png"
              alt="RedeASSO"
              className="h-11 w-11 object-contain"
            />
          </div>
          <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            <h1 className="text-xl font-bold tracking-tight text-white">
              RedeASSO
            </h1>
            <p className="mt-0.5 text-xs text-white/60">Sistema de Gestão</p>
          </div>
        </div>

        {/* Nav */}
        <nav
          aria-label="Navegação principal"
          className="flex-1 overflow-y-auto py-4"
        >
          {navigation.map((item) => {
            const isActive = location === item.href;
            if (!item.href) {
              return (
                <button
                  key={item.name}
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Disponível em breve"
                  className={cn(
                    menuItemClass,
                    "cursor-not-allowed border-transparent text-white/35",
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={menuLabelClass}>{item.name}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  menuItemClass,
                  isActive
                    ? "border-white bg-white/20 text-white"
                    : "border-transparent text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={menuLabelClass}>{item.name}</span>
              </Link>
            );
          })}
          {!session?.areaCentralConnected && (
            <Link
              href="/conexao-area-central"
              aria-current={
                location === "/conexao-area-central" ? "page" : undefined
              }
              className={cn(
                menuItemClass,
                location === "/conexao-area-central"
                  ? "border-white bg-white/20 text-white"
                  : "border-transparent text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Link2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className={menuLabelClass}>Conectar Área Central</span>
            </Link>
          )}
        </nav>

        {/* Rodapé: Notificações + Configurações + Sair */}
        <div className="mt-auto border-t border-white/10">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Disponível em breve"
            className={cn(
              menuItemClass,
              "cursor-not-allowed border-transparent py-3.5 text-white/35",
            )}
          >
            <Bell className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={menuLabelClass}>Notificações</span>
          </button>

          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Disponível em breve"
            className={cn(
              menuItemClass,
              "cursor-not-allowed border-transparent py-3.5 text-white/35",
            )}
          >
            <Settings className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={menuLabelClass}>Configurações</span>
          </button>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className={cn(
              menuItemClass,
              "border-transparent py-3.5 text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={menuLabelClass}>Sair</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
