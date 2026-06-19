import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseTags, hasTagSeparator } from "@/lib/parseTags";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Texto auxiliar exibido abaixo do campo. Default: orientação padrão. */
  helperText?: string | null;
}

export function TagInput({ value, onChange, placeholder, helperText }: Props) {
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = (raw: string) => {
    const next = parseTags(raw, value);
    if (next.length !== value.length || next.some((v, i) => v !== value[i])) {
      onChange(next);
    }
  };

  const onChangeInput = (raw: string) => {
    if (hasTagSeparator(raw)) {
      // Separador encontrado: processa imediatamente e mantém o restante (último trecho sem separador) no draft.
      const segments = raw.split(/[;\r\n]+/g);
      const tail = segments.pop() ?? "";
      const head = segments.join(";");
      commitDraft(head);
      setDraft(tail);
    } else {
      setDraft(raw);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!hasTagSeparator(text)) return; // deixa o paste padrão acontecer
    e.preventDefault();
    commitDraft((draft + text));
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ";") {
      e.preventDefault();
      commitDraft(draft);
      setDraft("");
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditingValue(value[i]);
  };
  const commitEdit = () => {
    if (editingIndex === null) return;
    const merged = [...value];
    merged.splice(editingIndex, 1);
    const next = parseTags(editingValue, merged);
    onChange(next);
    setEditingIndex(null);
    setEditingValue("");
  };

  const help = helperText === null
    ? null
    : helperText ?? "Separe os itens com ponto e vírgula ou escreva um por linha.";

  return (
    <div>
      <div
        className="rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2">
          {value.map((t, i) =>
            editingIndex === i ? (
              <Input
                key={`edit-${i}`}
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === "Escape") {
                    setEditingIndex(null);
                    setEditingValue("");
                  }
                }}
                className="h-7 w-auto min-w-[120px] px-2 py-0"
              />
            ) : (
              <Badge key={`${t}-${i}`} variant="secondary" className="gap-1 pr-1">
                <button
                  type="button"
                  onDoubleClick={() => startEdit(i)}
                  className="cursor-text bg-transparent"
                  aria-label={`Editar ${t}`}
                >
                  {t}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                  aria-label={`Remover ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          )}
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => onChangeInput(e.target.value)}
            onPaste={onPaste}
            onKeyDown={onKey}
            onBlur={() => {
              if (draft.trim()) {
                commitDraft(draft);
                setDraft("");
              }
            }}
            placeholder={placeholder ?? "Digite e pressione Enter ou cole uma lista"}
            className="min-w-[140px] flex-1 border-0 px-1 py-0 shadow-none focus-visible:ring-0"
            aria-label="Adicionar etiqueta"
          />
        </div>
      </div>
      {help && (
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      )}
    </div>
  );
}
