"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type {
  CounterpartyTradeoffOption,
  NegotiationDetail,
  NegotiationSummary,
} from "@/lib/radar-types";

type Props = {
  initialSelectedId?: string;
};

export function NegotiationsView({ initialSelectedId }: Props) {
  const [items, setItems] = useState<NegotiationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [detail, setDetail] = useState<NegotiationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/negotiations", { cache: "no-store" });
      const payload = (await res.json()) as { ok: boolean; negotiations?: NegotiationSummary[] };
      if (payload.ok) {
        setItems(payload.negotiations ?? []);
        if (!selectedId && payload.negotiations?.[0]) setSelectedId(payload.negotiations[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setError(null);
    const res = await fetch(`/api/negotiations/${id}`, { cache: "no-store" });
    const payload = (await res.json()) as { ok: boolean; detail?: NegotiationDetail; error?: string };
    if (payload.ok && payload.detail) setDetail(payload.detail);
    else setError(payload.error ?? "failed to load negotiation");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [loadDetail, selectedId]);

  async function reset() {
    await fetch("/api/negotiations/reset", { method: "POST" });
    setSelectedId(null);
    setDetail(null);
    await refresh();
  }

  async function respond(option: CounterpartyTradeoffOption, adjustedParameters: Record<string, string>) {
    if (!detail) return;
    const res = await fetch(`/api/negotiations/${detail.negotiation.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: option.id, adjustedParameters }),
    });
    const payload = (await res.json()) as { ok: boolean; detail?: NegotiationDetail; error?: string };
    if (payload.ok && payload.detail) {
      setDetail(payload.detail);
      await refresh();
    } else {
      setError(payload.error ?? "respond failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <SectionLabel>Negotiations</SectionLabel>
          <h1 className="mt-1 text-xl font-semibold text-ink">Live tender negotiations</h1>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Gemini writes the agent offers and dynamic trade-off options when configured.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => void reset()}>Reset</Button>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold text-ink">Threads</div>
          </CardHeader>
          <CardBody className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-[var(--radius-sm)] border px-3 py-2 text-left text-[12px] ${
                  item.id === selectedId ? "border-rule-strong bg-bg-sunk" : "border-rule bg-bg-elev"
                }`}
              >
                <div className="font-semibold text-ink">{item.title}</div>
                <div className="mt-1 flex justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                  <span>{item.status}</span>
                  <span>{item.rounds} rounds</span>
                </div>
              </button>
            ))}
            {items.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-ink-mute">No negotiations yet.</div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            {error ? <div className="text-[12px] text-bad">{error}</div> : null}
            {!detail ? (
              <div className="py-12 text-center text-[12px] text-ink-mute">Select a negotiation.</div>
            ) : (
              <>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                    {detail.negotiation.status}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    {detail.opportunity?.title ?? detail.finding.title}
                  </h2>
                  <p className="text-[12px] text-ink-3">{detail.opportunity?.buyer ?? detail.finding.sourceName}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Metric label="Opening" value={money(detail.negotiation.openingPrice)} />
                  <Metric label="Target" value={money(detail.negotiation.targetPrice)} />
                  <Metric label="Rounds" value={String(detail.negotiation.rounds)} />
                  <Metric label="Agreed" value={detail.negotiation.agreedPrice ? money(detail.negotiation.agreedPrice) : "-"} />
                </div>

                <div className="space-y-3">
                  {detail.messages.map((message) => (
                    <div key={message.id} className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk p-3">
                      <div className="mb-2 flex justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                        <span>{message.party}</span>
                        <span>{message.price ? money(message.price) : message.parsedIntent ?? ""}</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-2">{message.text}</pre>
                    </div>
                  ))}
                </div>

                {detail.negotiation.status === "awaiting_user" ? (
                  <div className="space-y-3">
                    <SectionLabel>Trade-off options</SectionLabel>
                    {detail.pendingOptions.map((option) => (
                      <TradeoffCard key={option.id} option={option} onSend={respond} />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function TradeoffCard({
  option,
  onSend,
}: {
  option: CounterpartyTradeoffOption;
  onSend: (option: CounterpartyTradeoffOption, adjusted: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(option.parameters.map((param) => [param.key, param.defaultValue])),
  );
  const [sending, setSending] = useState(false);
  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-3">
      <div className="font-semibold text-ink">{option.title}</div>
      <p className="mt-1 text-[12px] text-ink-3">{option.summary}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {option.parameters.map((param) => (
          <label key={param.key} className="text-[11px] font-medium text-ink-2">
            {param.label}
            <select
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-rule bg-bg px-2 py-1.5 text-[12px] text-ink"
              value={values[param.key] ?? param.defaultValue}
              onChange={(event) => setValues((current) => ({ ...current, [param.key]: event.target.value }))}
            >
              {param.options.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <Button
        className="mt-3"
        size="sm"
        disabled={sending}
        onClick={async () => {
          setSending(true);
          try {
            await onSend(option, values);
          } finally {
            setSending(false);
          }
        }}
      >
        {sending ? "Sending..." : "Send counter-offer"}
      </Button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">{label}</div>
      <div className="mt-1 text-[13px] font-semibold text-ink">{value}</div>
    </div>
  );
}

function money(value: number) {
  return `EUR ${Math.round(value).toLocaleString("en-DE")}`;
}
