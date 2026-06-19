// Modal de confirmação de reagendamento (drag/edit de data).
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { formatDateBR } from "@/lib/calendar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fromDate: string | null;
  fromTime: string | null;
  toDate: string;
  defaultTime?: string;
  onConfirm: (time: string | null) => void;
}

export function RescheduleDialog({ open, onOpenChange, fromDate, fromTime, toDate, defaultTime, onConfirm }: Props) {
  const [time, setTime] = useState(defaultTime ?? fromTime ?? "");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reagendar publicação?</DialogTitle>
          <DialogDescription>Confirme a nova data e horário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {fromDate && (
            <p className="text-muted-foreground">
              Data anterior: <span className="font-medium text-foreground">{formatDateBR(fromDate)} {fromTime ?? ""}</span>
            </p>
          )}
          <p>Nova data: <span className="font-medium">{formatDateBR(toDate)}</span></p>
          <div className="space-y-1">
            <Label className="text-xs">Horário</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm(time || null)}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
