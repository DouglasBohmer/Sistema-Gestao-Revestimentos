import { Link } from "wouter"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <h1 className="text-9xl font-bold font-mono text-primary">404</h1>
      <h2 className="mt-4 text-2xl font-semibold">Página não encontrada</h2>
      <p className="mt-2 text-muted-foreground mb-8 text-center max-w-md">
        A página que você está procurando não existe ou foi movida.
      </p>
      <Link href="/">
        <Button size="lg">Voltar ao Painel</Button>
      </Link>
    </div>
  )
}
