import { Button } from "@/components/ui/Button";

export function FormFooter({
  onCancel,
  submitLabel = "Создать",
  disabled,
  loading,
  error,
}: {
  onCancel: () => void;
  submitLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="mt-2 flex flex-col gap-3">
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" disabled={disabled || loading}>
          {loading ? "Сохраняю…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
