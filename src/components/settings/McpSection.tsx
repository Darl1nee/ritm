"use client";
import { useState } from "react";
import clsx from "clsx";
import { Bot, Copy, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { ALL_SCOPES, READ_ONLY_SCOPES, type Scope } from "@/server/mcp/scopes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  useCreateMcpToken,
  useDeleteMcpToken,
  useMcpInfo,
  useMcpTokens,
  useRevokeMcpToken,
  useUpdateMcpToken,
  type McpToken,
} from "@/lib/queries";
import { ConnectInstructions } from "./ConnectInstructions";
import { ScopeGrid } from "./ScopeGrid";
import { ago, copyText, scopeSummary } from "./utils";

export function McpSection() {
  const { data: tokens, isLoading, error } = useMcpTokens();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<McpToken | null>(null);

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        icon={<Bot />}
        title="ИИ-агенты (MCP)"
        subtitle="Подключите Claude или другого агента — Ритм должен быть запущен"
        className="mb-4"
        action={
          tokens && tokens.length > 0 ? (
            <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setCreateOpen(true)}>
              Новый ключ
            </Button>
          ) : undefined
        }
      />
      {isLoading && <Skeleton className="h-16" />}
      {error && <p className="text-sm text-danger">Не удалось загрузить ключи: {error.message}</p>}
      {tokens && tokens.length === 0 && (
        <EmptyState text="Подключите Claude или другого агента" icon={<Bot />} onClick={() => setCreateOpen(true)} />
      )}
      {tokens && tokens.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {tokens.map((t) => (
            <TokenRow key={t.id} token={t} onEdit={() => setEditing(t)} />
          ))}
        </ul>
      )}
      <CreateTokenModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditTokenModal token={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function TokenRow({ token, onEdit }: { token: McpToken; onEdit: () => void }) {
  const revoke = useRevokeMcpToken();
  const del = useDeleteMcpToken();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const active = token.active;
  const chips = scopeSummary(token.scopes);

  return (
    <li className={clsx("flex flex-col gap-2 py-3", !active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 truncate text-[15px] font-medium">{token.name}</span>
        <code className="font-mono text-xs text-fg-sub">{token.prefix}…</code>
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            active ? "bg-success/10 text-success" : "bg-surface-2 text-fg-sub",
          )}
        >
          {active ? "активен" : "отозван"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.length ? (
          chips.map((c) => (
            <Pill key={c} size="sm" className="h-6 px-2.5 text-[11px]">
              {c}
            </Pill>
          ))
        ) : (
          <span className="text-xs text-fg-sub">Нет прав</span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-fg-sub">
          {token.last_used_at ? `использован ${ago(token.last_used_at)}` : "ещё не использовался"}
        </span>
        <div className="flex items-center gap-1.5">
          {active && (
            <Button size="sm" variant="ghost" icon={<ShieldCheck />} onClick={onEdit}>
              Права
            </Button>
          )}
          {confirm ? (
            <>
              <span className="hidden text-xs text-fg-sub sm:inline">
                {active ? "Агент сразу потеряет доступ." : "Удалить насовсем?"}
              </span>
              <Button
                size="sm"
                variant="danger"
                disabled={revoke.isPending || del.isPending}
                onClick={() => {
                  const m = active ? revoke : del;
                  m.mutate(token.id, {
                    onSuccess: () => {
                      setConfirm(false);
                      toast.success(active ? "Ключ отозван" : "Ключ удалён");
                    },
                    onError: (e) => toast.error(e.message),
                  });
                }}
              >
                {active ? "Да, отозвать" : "Да, удалить"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                Отмена
              </Button>
            </>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirm(true)}>
              {active ? "Отозвать" : "Удалить"}
            </Button>
          )}
        </div>
      </div>
      {confirm && active && <p className="text-xs text-fg-sub sm:hidden">Агент сразу потеряет доступ.</p>}
    </li>
  );
}

function CreateTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateMcpToken();
  const { data: info } = useMcpInfo();
  const toast = useToast();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([...READ_ONLY_SCOPES]);
  // Открытый ключ живёт только здесь, в состоянии модалки.
  const [secret, setSecret] = useState<string | null>(null);

  const close = () => {
    setSecret(null);
    setName("");
    setScopes([...READ_ONLY_SCOPES]);
    create.reset();
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || create.isPending) return;
    create.mutate(
      { name: name.trim(), scopes },
      { onSuccess: (r) => setSecret(r.token), onError: (err) => toast.error(err.message) },
    );
  };

  const url = info?.url ?? (typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "");

  return (
    <Modal open={open} onClose={secret ? () => undefined : close} title={secret ? "Ключ создан" : "Новый ключ"} width={560}>
      {secret ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-field bg-accent-soft px-3 py-2.5 text-[13px] text-accent">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Ключ показывается один раз — сохраните его сейчас.
          </div>
          <div className="flex flex-col gap-2">
            <div className="break-all rounded-field bg-surface-2 p-3 font-mono text-[15px] leading-6" data-testid="mcp-secret">
              {secret}
            </div>
            <Button
              size="sm"
              icon={<Copy />}
              className="self-start"
              onClick={async () => ((await copyText(secret)) ? toast.success("Ключ скопирован") : toast.error("Не удалось скопировать"))}
            >
              Копировать
            </Button>
          </div>
          <ConnectInstructions url={url} token={secret} />
          <Button variant="primary" onClick={close} className="self-end">
            Готово
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Название">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Claude Code на ноутбуке" autoFocus maxLength={80} />
          </Field>
          <Field label="Права">
            <ScopeGrid value={scopes} onChange={setScopes} />
          </Field>
          <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending} className="self-end">
            Создать ключ
          </Button>
        </form>
      )}
    </Modal>
  );
}

function EditTokenModal({ token, onClose }: { token: McpToken | null; onClose: () => void }) {
  return (
    <Modal open={!!token} onClose={onClose} title="Права ключа" width={560}>
      {token && <EditForm key={token.id} token={token} onClose={onClose} />}
    </Modal>
  );
}

function EditForm({ token, onClose }: { token: McpToken; onClose: () => void }) {
  const update = useUpdateMcpToken();
  const toast = useToast();
  const [name, setName] = useState(token.name);
  const [scopes, setScopes] = useState<Scope[]>(() => ALL_SCOPES.filter((s) => token.scopes.includes(s)));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        update.mutate(
          { id: token.id, name: name.trim(), scopes },
          { onSuccess: () => { toast.success("Права сохранены"); onClose(); }, onError: (err) => toast.error(err.message) },
        );
      }}
    >
      <Field label="Название">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Field label="Права">
        <ScopeGrid value={scopes} onChange={setScopes} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || update.isPending}>Сохранить</Button>
      </div>
    </form>
  );
}
