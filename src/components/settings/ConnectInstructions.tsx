"use client";
import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "./utils";

function CodeBlock({ code, label }: { code: string; label: string }) {
  const toast = useToast();
  return (
    <div className="flex flex-col gap-2">
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-field bg-surface-2 p-3 font-mono text-xs leading-5">{code}</pre>
      <Button
        size="sm"
        icon={<Copy />}
        className="self-start"
        onClick={async () => (await copyText(code)) ? toast.success(`${label} скопировано`) : toast.error("Не удалось скопировать")}
      >
        Копировать
      </Button>
    </div>
  );
}

/** Готовые инструкции подключения с подставленными url и ключом. */
export function ConnectInstructions({ url, token }: { url: string; token: string }) {
  const [tab, setTab] = useState<"code" | "desktop">("code");
  const cmd = `claude mcp add --transport http ritm ${url} --header "Authorization: Bearer ${token}"`;
  const json = JSON.stringify(
    {
      mcpServers: {
        ritm: {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization:${RITM_AUTH}"],
          env: { RITM_AUTH: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={tab}
        onChange={setTab}
        fullWidth
        options={[
          { value: "code", label: "Claude Code" },
          { value: "desktop", label: "Claude Desktop" },
        ]}
      />
      {tab === "code" ? (
        <>
          <p className="text-xs text-fg-sub">Выполните команду в терминале.</p>
          <CodeBlock code={cmd} label="Команда" />
        </>
      ) : (
        <>
          <p className="text-xs text-fg-sub">Добавьте в claude_desktop_config.json и перезапустите Claude Desktop.</p>
          <CodeBlock code={json} label="Конфиг" />
        </>
      )}
    </div>
  );
}
