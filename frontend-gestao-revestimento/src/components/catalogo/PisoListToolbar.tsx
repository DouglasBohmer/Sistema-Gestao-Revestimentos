import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Filter, Search } from "lucide-react";
import { ParametrosPrecoDialog } from "./ParametrosPrecoDialog";
import { EMPTY_PISO_FILTERS, type PisoFilters } from "@/lib/piso-list-state";

type Props = {
  search: string;
  onSearch: (value: string) => void;
  filters: PisoFilters;
  onFilters: (filters: PisoFilters) => void;
  onParametersSaved: () => void;
};
export function PisoListToolbar({
  search,
  onSearch,
  filters,
  onFilters,
  onParametersSaved,
}: Props) {
  const count = [filters.tipo, filters.classificacao, filters.bordas].filter(
    Boolean,
  ).length;
  const selectStyle = "h-9 w-full rounded-md border bg-background px-3 text-sm";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-60 flex-1 sm:max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="search-input"
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="pl-9"
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            <Filter className="mr-2 size-4" />
            Filtros{count > 0 ? ` (${count})` : ""}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="space-y-4">
          <p className="font-semibold">Filtrar pisos</p>
          <div className="space-y-1">
            <Label htmlFor="filtro-tipo">Tipo de piso</Label>
            <Input
              id="filtro-tipo"
              placeholder="Ex.: Acetinado"
              value={filters.tipo}
              onChange={(event) =>
                onFilters({ ...filters, tipo: event.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-classificacao">Classificação de uso</Label>
            <select
              id="filtro-classificacao"
              className={selectStyle}
              value={filters.classificacao}
              onChange={(event) =>
                onFilters({ ...filters, classificacao: event.target.value })
              }
            >
              <option value="">Todas</option>
              {["LA", "LB", "LC", "LD", "LE", "LF"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filtro-bordas">Acabamento das bordas</Label>
            <select
              id="filtro-bordas"
              className={selectStyle}
              value={filters.bordas}
              onChange={(event) =>
                onFilters({ ...filters, bordas: event.target.value })
              }
            >
              <option value="">Todos</option>
              <option value="RETIFICADO">Retificado</option>
              <option value="BOLD">Bold</option>
            </select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onFilters({
                ...EMPTY_PISO_FILTERS,
                onlyActive: filters.onlyActive,
              })
            }
          >
            Limpar filtros
          </Button>
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <span
          className={
            filters.onlyActive ? "text-muted-foreground" : "font-medium"
          }
        >
          Todos
        </span>
        <Switch
          aria-label="Mostrar somente pisos ativos"
          checked={filters.onlyActive}
          onCheckedChange={(onlyActive) =>
            onFilters({ ...filters, onlyActive })
          }
        />
        <span
          className={
            filters.onlyActive ? "font-medium" : "text-muted-foreground"
          }
        >
          Ativos
        </span>
      </div>
      <ParametrosPrecoDialog onSaved={onParametersSaved} />
    </div>
  );
}
