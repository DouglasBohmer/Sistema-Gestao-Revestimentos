import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef, type ComponentType } from "react";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Cadastro from "@/pages/Cadastro";
import Calcular from "@/pages/Calcular";
import MapaEstoque from "@/pages/MapaEstoque";
import ConexaoAreaCentral from "@/pages/ConexaoAreaCentral";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      staleTime: 0,
    },
  },
});

const authenticatedRoutes: Array<{
  path: string;
  component: ComponentType;
}> = [
  { path: "/", component: Dashboard },
  { path: "/cadastro", component: Cadastro },
  { path: "/calcular", component: Calcular },
  { path: "/mapa-estoque", component: MapaEstoque },
  { path: "/conexao-area-central", component: ConexaoAreaCentral },
];

function PersistentRoutes() {
  const [location] = useLocation();
  const activeQueryClient = useQueryClient();
  const visitedRoutes = useRef(new Set<string>()).current;
  const routeExists = authenticatedRoutes.some(
    (route) => route.path === location,
  );

  useEffect(() => {
    void activeQueryClient.invalidateQueries({ refetchType: "active" });
  }, [activeQueryClient, location]);

  if (routeExists) visitedRoutes.add(location);

  return (
    <>
      {authenticatedRoutes.map(({ path, component: Component }) =>
        visitedRoutes.has(path) ? (
          <div key={path} className={location === path ? "block" : "hidden"}>
            <Component />
          </div>
        ) : null,
      )}
      {!routeExists && <NotFound />}
    </>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-sm text-gray-500">
        Carregando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <PersistentRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
