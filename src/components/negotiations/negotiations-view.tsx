"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type {
  CounterpartyTradeoffOption,
  NegotiationDetail,
  NegotiationSummary,
  NegotiationTermField,
  TermMovement,
} from "@/lib/radar-types";
import { Sparkline } from "@/components/ui/sparkline";

type Props = {
  initialSelectedId?: string;
};

export function NegotiationsView({ initialSelectedId }: Props) {
  const [items, setItems] = useState<NegotiationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [detail, setDetail] = useState<NegotiationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialSelectedId));
  const [isResponding, setIsResponding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/negotiations", { cache: "no-store" });
      const payload = (await res.json()) as { ok: boolean; negotiations?: NegotiationSummary[] };
      if (payload.ok) {
        const seen = new Set<string>();
        const deduped = (payload.negotiations ?? []).filter((item) => {
          if (seen.has(item.approvalId)) return false;
          seen.add(item.approvalId);
          return true;
        });
        setItems(deduped);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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

  function selectThread(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
  }

  function backToList() {
    setMobileDetail(false);
  }

  async function reset() {
    await fetch("/api/negotiations/reset", { method: "POST" });
    setSelectedId(null);
    setDetail(null);
    setMobileDetail(false);
    await refresh();
  }

  async function respond(option: CounterpartyTradeoffOption, adjustedParameters: Record<string, string>) {
    if (!detail || isResponding) return;
    setIsResponding(true);
    try {
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
    } finally {
      setIsResponding(false);
    }
  }

  async function respondWithIntent(intent: "accept" | "deny") {
    if (!detail || isResponding) return;
    setIsResponding(true);
    try {
      const res = await fetch(`/api/negotiations/${detail.negotiation.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const payload = (await res.json()) as { ok: boolean; detail?: NegotiationDetail; error?: string };
      if (payload.ok && payload.detail) {
        setDetail(payload.detail);
        await refresh();
      } else {
        setError(payload.error ?? "respond failed");
      }
    } finally {
      setIsResponding(false);
    }
  }

  const showList = !mobileDetail;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <SectionLabel>Negotiations</SectionLabel>
          <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">Live tender negotiations</h1>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Gemini writes the agent offers and dynamic trade-off options when configured.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={() => void reset()}>
            Reset
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className={showList ? "block" : "hidden lg:block"}>
          <CardHeader>
            <div className="text-[13px] font-semibold text-ink">Threads</div>
          </CardHeader>
          <CardBody className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectThread(item.id)}
                className={`w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-left text-[12px] transition-colors ${
                  item.id === selectedId ? "border-rule-strong bg-bg-sunk" : "border-rule bg-bg-elev hover:border-rule-strong"
                }`}
              >
                <div className="font-semibold text-ink">{item.title}</div>
                <div className="mt-1 text-[11px] text-ink-3">{item.buyer}</div>
                <div className="mt-1 flex justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                  <span>{formatStatus(item.status)}</span>
                  <span>{item.rounds} rounds</span>
                </div>
              </button>
            ))}
            {items.length === 0 ? (
              <div className="py-8 text-center text-[12px] text-ink-mute">No negotiations yet.</div>
            ) : null}
          </CardBody>
        </Card>

        <Card className={mobileDetail ? "block" : "hidden lg:block"}>
          <CardBody className="space-y-4">
            {mobileDetail ? (
              <button
                type="button"
                onClick={backToList}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:text-accent-deep lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                All threads
              </button>
            ) : null}

            {error ? <div className="text-[12px] text-bad">{error}</div> : null}
            {!detail ? (
              <div className="py-12 text-center text-[12px] text-ink-mute">Select a negotiation.</div>
            ) : (
              <>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                    {formatStatus(detail.negotiation.status)}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    {detail.opportunity?.title ?? detail.finding.title}
                  </h2>
                  <p className="text-[12px] text-ink-3">
                    {detail.opportunity?.buyer ?? detail.finding.sourceName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label="Opening" value={money(detail.negotiation.openingPrice)} />
                  <Metric label="Target" value={money(detail.negotiation.targetPrice)} />
                  <Metric label="Rounds" value={String(detail.negotiation.rounds)} />
                  <Metric
                    label="Agreed"
                    value={detail.negotiation.agreedPrice ? money(detail.negotiation.agreedPrice) : "—"}
                  />
                </div>

                <OfferDashboard detail={detail} />

                <div className="space-y-3">
                  <SectionLabel>Message generation</SectionLabel>
                  <p className="text-[11px] text-ink-3">
                    Agent offers and buyer replies are tracked separately. Parsed buyer data feeds the chart above.
                  </p>
                  {detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-[var(--radius-sm)] border p-3 ${
                        message.party === "agent"
                          ? "border-accent/30 bg-accent/5"
                          : "border-signal/30 bg-signal/5"
                      }`}
                    >
                      <div className="mb-2 flex justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                        <span>{message.party === "agent" ? "Agent offer" : "Buyer reply"}</span>
                        <span>
                          {message.price
                            ? money(message.price)
                            : message.parsedOffer?.referencedPrice
                              ? money(message.parsedOffer.referencedPrice)
                              : (message.parsedIntent ?? "")}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-2">
                        {message.text}
                      </pre>
                      {message.parsedOffer ? (
                        <div className="mt-2 space-y-1 text-[11px] text-ink-3">
                          <div>{message.parsedOffer.summary}</div>
                          {message.parsedOffer.terms
                            ? Object.entries(message.parsedOffer.terms).map(([key, value]) => (
                                <span key={key} className="mr-2 inline-block rounded-full bg-bg px-2 py-0.5 font-mono text-[10px]">
                                  {key.replaceAll("_", " ")}: {value}
                                </span>
                              ))
                            : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                {detail.negotiation.status === "awaiting_user" ? (
                  <div className="space-y-3">
                    <SectionLabel>Your response</SectionLabel>
                    <IntentActions
                      disabled={isResponding}
                      onAccept={() => respondWithIntent("accept")}
                      onDeny={() => respondWithIntent("deny")}
                    />
                    <SectionLabel>Counter-offer options</SectionLabel>
                    {detail.dashboard.latestParsed ? (
                      <p className="text-[11px] text-ink-3">{detail.dashboard.latestParsed.summary}</p>
                    ) : null}
                    {detail.pendingOptions.map((option) => (
                      <TradeoffCard key={option.id} option={option} disabled={isResponding} onSend={respond} />
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

function IntentActions({
  disabled,
  onAccept,
  onDeny,
}: {
  disabled: boolean;
  onAccept: () => Promise<void>;
  onDeny: () => Promise<void>;
}) {
  const [acting, setActing] = useState<"accept" | "deny" | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        disabled={disabled}
        onClick={async () => {
          if (disabled) return;
          setActing("accept");
          try {
            await onAccept();
          } finally {
            setActing(null);
          }
        }}
      >
        {acting === "accept" ? "Accepting..." : "Accept"}
      </Button>
      <Button
        size="sm"
        variant="danger"
        disabled={disabled}
        onClick={async () => {
          if (disabled) return;
          setActing("deny");
          try {
            await onDeny();
          } finally {
            setActing(null);
          }
        }}
      >
        {acting === "deny" ? "Denying..." : "Deny"}
      </Button>
    </div>
  );
}

function TradeoffCard({
  option,
  disabled,
  onSend,
}: {
  option: CounterpartyTradeoffOption;
  disabled: boolean;
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
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {option.parameters.map((param) => (
          <label key={param.key} className="text-[11px] font-medium text-ink-2">
            {param.label}
            <select
              className="mt-1 w-full rounded-[var(--radius-sm)] border border-rule bg-bg px-2 py-2 text-[12px] text-ink disabled:opacity-50"
              value={values[param.key] ?? param.defaultValue}
              disabled={disabled}
              onChange={(event) => setValues((current) => ({ ...current, [param.key]: event.target.value }))}
            >
              {param.options.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <Button
        className="mt-3 w-full sm:w-auto"
        size="sm"
        disabled={disabled}
        onClick={async () => {
          if (disabled) return;
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

function OfferDashboard({ detail }: { detail: NegotiationDetail }) {
  const { dashboard } = detail;
  const agentSeries = dashboard.offerTimeline.map((point) => point.agentPrice).filter((v): v is number => v != null);
  const buyerSeries = dashboard.offerTimeline
    .map((point) => point.counterpartyPrice)
    .filter((v): v is number => v != null);

  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-elev p-3 space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">Negotiation dashboard</div>

      {dashboard.termFields.length > 0 ? (
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">Active terms</div>
          {dashboard.termFields.map((field) => (
            <TermComparisonRow key={field.key} field={field} />
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,200px)]">
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">Price trajectory</div>
          <div className="flex items-center gap-3 text-[11px] text-ink-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Your offer
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-signal" />
              Buyer position
            </span>
          </div>
          {agentSeries.length > 0 || buyerSeries.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {agentSeries.length > 0 ? (
                <Sparkline data={agentSeries} width={160} height={48} stroke="var(--color-accent)" showDots />
              ) : null}
              {buyerSeries.length > 0 ? (
                <Sparkline data={buyerSeries} width={160} height={48} stroke="var(--color-signal)" showDots />
              ) : null}
            </div>
          ) : (
            <div className="text-[12px] text-ink-mute">Offer data appears after the first exchange.</div>
          )}
        </div>
        <div className="grid gap-2">
          <Metric
            label="Your offer"
            value={dashboard.currentAgentOffer ? money(dashboard.currentAgentOffer) : "—"}
          />
          <Metric
            label="Buyer position"
            value={dashboard.currentCounterpartyOffer ? money(dashboard.currentCounterpartyOffer) : "—"}
          />
          {dashboard.gapPct != null ? <Metric label="Gap" value={`${dashboard.gapPct}%`} /> : null}
        </div>
      </div>
    </div>
  );
}

function TermComparisonRow({ field }: { field: NegotiationTermField }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-rule bg-bg-sunk p-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">{field.label}</div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[12px]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-accent">You</div>
          <div className="font-semibold text-ink">{field.agentDisplay ?? "—"}</div>
        </div>
        <MovementArrow movement={field.movement} />
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.1em] text-signal">Buyer</div>
          <div className="font-semibold text-ink">{field.counterpartyDisplay ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

function MovementArrow({ movement }: { movement: TermMovement }) {
  const labels: Record<TermMovement, string> = {
    buyer_pressing: "Buyer pushing",
    agent_conceding: "You conceding",
    agent_proposed: "You proposed",
    buyer_proposed: "Buyer proposed",
    aligned: "Aligned",
    diverging: "Diverging",
  };
  const arrows: Record<TermMovement, string> = {
    buyer_pressing: "←",
    agent_conceding: "→",
    agent_proposed: "↗",
    buyer_proposed: "↙",
    aligned: "=",
    diverging: "↔",
  };
  return (
    <div className="text-center text-[10px] font-semibold text-ink-3">
      <div className="text-base leading-none">{arrows[movement]}</div>
      <div className="mt-0.5">{labels[movement]}</div>
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

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toUpperCase();
}
