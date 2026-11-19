"use client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({ open, title, text, confirmLabel = "Удалить", loading, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <p className="text-sm leading-relaxed text-fg-sub">{text}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
