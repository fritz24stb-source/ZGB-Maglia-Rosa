"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Lock,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/ui";
import type { ManualEntryOption, ManualEntryState } from "@/lib/manual-entry/types";

type LoadState = "loading" | "success" | "unauthorized" | "error";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string; points: number }
  | { kind: "error"; message: string };

type ManualEntryPostResponse = {
  activityId: string;
  points: number;
  message: string;
  state: ManualEntryState;
};

export function ManualEntryPanel() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [manualState, setManualState] = useState<ManualEntryState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [activityStartedLocal, setActivityStartedLocal] = useState("");
  const [sportType, setSportType] = useState("Ride");
  const [distanceKm, setDistanceKm] = useState("");
  const [comment, setComment] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    const controller = new AbortController();

    loadManualEntryState(controller.signal).catch((error: unknown) => {
      if (controller.signal.aborted) {
        return;
      }

      setLoadState("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Manuelle Eingabe konnte nicht geladen werden.",
      );
    });

    return () => {
      controller.abort();
    };
  }, []);

  const readyState = manualState?.kind === "ready" ? manualState : null;
  const openOptions = useMemo(
    () => readyState?.options.filter((option) => option.status === "open") ?? [],
    [readyState],
  );
  const selectedOption =
    openOptions.find((option) => option.ruleId === selectedRuleId) ??
    openOptions[0] ??
    null;

  useEffect(() => {
    if (!readyState) {
      return;
    }

    if (!activityStartedLocal) {
      setActivityStartedLocal(readyState.defaultActivityStartedLocal);
    }

    if (!selectedRuleId && openOptions[0]) {
      setSelectedRuleId(openOptions[0].ruleId);
    }
  }, [activityStartedLocal, openOptions, readyState, selectedRuleId]);

  async function loadManualEntryState(signal?: AbortSignal) {
    setLoadState("loading");
    setErrorMessage(null);

    const response = await fetch("/api/manual-entry", { signal });
    const payload = (await response.json()) as ManualEntryState | { error?: string };

    if (!response.ok) {
      if (response.status === 401) {
        setLoadState("unauthorized");
        setManualState({ kind: "anonymous" });
        return;
      }

      throw new Error(
        "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "error" in payload && payload.error
            ? payload.error
            : "Manuelle Eingabe konnte nicht geladen werden.",
      );
    }

    applyManualState(payload as ManualEntryState);
    setLoadState("success");
  }

  function applyManualState(nextState: ManualEntryState) {
    setManualState(nextState);

    if (nextState.kind !== "ready") {
      setSelectedRuleId("");
      return;
    }

    const firstOpenOption = nextState.options.find(
      (option) => option.status === "open",
    );

    setSelectedRuleId((current) =>
      nextState.options.some(
        (option) => option.ruleId === current && option.status === "open",
      )
        ? current
        : (firstOpenOption?.ruleId ?? ""),
    );
    setActivityStartedLocal((current) =>
      current ? current : nextState.defaultActivityStartedLocal,
    );
  }

  async function submitManualEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedOption) {
      setSubmitState({
        kind: "error",
        message: "Keine offene manuelle Kategorie ausgewaehlt.",
      });
      return;
    }

    setSubmitState({ kind: "submitting" });

    const response = await fetch("/api/manual-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: selectedOption.ruleId,
        activityStartedLocal,
        sportType,
        distanceKm,
        comment,
      }),
    });
    const payload = (await response.json()) as
      | ManualEntryPostResponse
      | { error?: string };

    if (!response.ok) {
      setSubmitState({
        kind: "error",
        message:
          "error" in payload && payload.error
            ? payload.error
            : "Manuelle Eingabe konnte nicht gespeichert werden.",
      });
      return;
    }

    const successPayload = payload as ManualEntryPostResponse;

    applyManualState(successPayload.state);
    setComment("");
    setSubmitState({
      kind: "success",
      message: successPayload.message,
      points: successPayload.points,
    });
  }

  if (loadState === "loading") {
    return <LoadingState />;
  }

  if (loadState === "unauthorized" || manualState?.kind === "anonymous") {
    return <UnauthorizedState />;
  }

  if (loadState === "error") {
    return (
      <MessageBox
        icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
        tone="danger"
        title="Manuelle Eingabe nicht verfuegbar"
        message={errorMessage ?? "Status konnte nicht geladen werden."}
        action={
          <button
            type="button"
            className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-300 px-3 text-sm font-medium text-red-900"
            onClick={() => void loadManualEntryState()}
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            Erneut laden
          </button>
        }
      />
    );
  }

  if (manualState?.kind === "unconfigured") {
    return (
      <MessageBox
        icon={<AlertTriangle aria-hidden className="h-5 w-5" />}
        tone="warning"
        title="Konfiguration fehlt"
        message={manualState.message}
      />
    );
  }

  if (manualState?.kind === "unavailable") {
    return (
      <section className="grid gap-4">
        <MessageBox
          icon={<Lock aria-hidden className="h-5 w-5" />}
          tone="warning"
          title="Aktuell keine manuelle Eingabe moeglich"
          message={manualState.reason}
        />
        <WindowSummary state={manualState} />
      </section>
    );
  }

  if (!readyState) {
    return null;
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock aria-hidden className="h-5 w-5 text-signal-blue" />
              <h2 className="text-base font-semibold text-asphalt-900">
                Aktuelles Eingabefenster
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-asphalt-600">
              {openOptions.length > 0
                ? "Mindestens eine Kategorie ist offen."
                : "Alle Kategorien sind aktuell geschlossen oder bereits genutzt."}
            </p>
          </div>
          <StatusBadge tone={openOptions.length > 0 ? "success" : "warning"}>
            {openOptions.length > 0 ? "Offen" : "Geschlossen"}
          </StatusBadge>
        </div>

        <div className="mt-5 grid gap-3">
          {readyState.options.map((option) => (
            <OptionRow
              key={option.ruleId}
              option={option}
              selected={option.ruleId === selectedOption?.ruleId}
              onSelect={() => setSelectedRuleId(option.ruleId)}
            />
          ))}
        </div>
      </div>

      <form
        className="rounded-lg border border-asphalt-200 bg-white p-5 shadow-line"
        onSubmit={(event) => void submitManualEntry(event)}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-asphalt-900">
              Manuelle Aktivitaet erfassen
            </h2>
            <p className="mt-1 text-sm text-asphalt-600">
              Saison: {readyState.season.name}
            </p>
          </div>
          {selectedOption ? (
            <StatusBadge tone="info">{selectedOption.points} P</StatusBadge>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4">
          <SelectField
            label="Kategorie"
            value={selectedOption?.ruleId ?? ""}
            onChange={setSelectedRuleId}
            disabled={openOptions.length === 0}
          >
            {openOptions.length === 0 ? (
              <option value="">Keine offene Kategorie</option>
            ) : null}
            {openOptions.map((option) => (
              <option key={option.ruleId} value={option.ruleId}>
                {option.label} - {option.points} Punkte
              </option>
            ))}
          </SelectField>

          <InputField
            label="Datum und Zeit"
            type="datetime-local"
            value={activityStartedLocal}
            onChange={setActivityStartedLocal}
            required
            disabled={!selectedOption}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Aktivitaetstyp"
              value={sportType}
              onChange={setSportType}
              disabled={!selectedOption}
            >
              <option value="Ride">Ride</option>
              <option value="VirtualRide">VirtualRide</option>
              <option value="GravelRide">GravelRide</option>
              <option value="MountainBikeRide">MountainBikeRide</option>
            </SelectField>
            <InputField
              label="Distanz km"
              type="number"
              value={distanceKm}
              onChange={setDistanceKm}
              min="0"
              max="1000"
              step="0.1"
              placeholder="optional"
              disabled={!selectedOption}
            />
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
            Kommentar
            <textarea
              className="focus-ring min-h-24 rounded-md border border-asphalt-300 bg-white px-3 py-2 text-sm text-asphalt-900"
              value={comment}
              maxLength={500}
              disabled={!selectedOption}
              onChange={(event) => setComment(event.target.value)}
              placeholder="optional"
            />
          </label>
        </div>

        {submitState.kind === "success" ? (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden className="h-4 w-4" />
              {submitState.message} {submitState.points} Punkte wurden
              zugewiesen.
            </div>
          </div>
        ) : null}

        {submitState.kind === "error" ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {submitState.message}
          </div>
        ) : null}

        <button
          type="submit"
          className="focus-ring mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-asphalt-300"
          disabled={!selectedOption || submitState.kind === "submitting"}
        >
          {submitState.kind === "submitting" ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle aria-hidden className="h-4 w-4" />
          )}
          Eintrag speichern
        </button>
      </form>

      <div className="lg:col-span-2">
        <WindowSummary state={readyState} />
      </div>
    </section>
  );
}

function OptionRow({
  onSelect,
  option,
  selected,
}: {
  onSelect: () => void;
  option: ManualEntryOption;
  selected: boolean;
}) {
  const disabled = option.status !== "open";

  return (
    <button
      type="button"
      className={cn(
        "focus-ring rounded-lg border p-3 text-left transition",
        selected
          ? "border-asphalt-900 bg-asphalt-50"
          : "border-asphalt-200 bg-white hover:border-asphalt-300",
        disabled && "cursor-not-allowed opacity-70",
      )}
      disabled={disabled}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-asphalt-900">
            {option.label}
          </p>
          <p className="mt-1 text-xs text-asphalt-500">
            {formatDateTime(option.opensAt)} bis {formatDateTime(option.closesAt)}
          </p>
        </div>
        <StatusBadge tone={statusTone(option.status)}>
          {statusLabel(option.status)}
        </StatusBadge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-asphalt-500">
        <span>{option.points} Punkte</span>
        <span>
          Rest: {option.remainingEntries}/{option.maxEntries}
        </span>
        {option.unavailableReason ? <span>{option.unavailableReason}</span> : null}
      </div>
    </button>
  );
}

function WindowSummary({
  state,
}: {
  state: Extract<ManualEntryState, { kind: "ready" | "unavailable" }>;
}) {
  return (
    <div className="rounded-lg border border-asphalt-200 bg-white p-4 shadow-line">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-asphalt-900">
            Naechstes Zeitfenster
          </p>
          <p className="mt-1 text-sm text-asphalt-600">
            {state.nextOpensAt
              ? formatDateTime(state.nextOpensAt)
              : "Kein weiteres Zeitfenster ermittelt."}
          </p>
        </div>
        <div className="text-sm text-asphalt-500">
          Stand: {formatDateTime(state.generatedAt)}
        </div>
      </div>
    </div>
  );
}

function SelectField({
  children,
  disabled,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <select
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900 disabled:bg-asphalt-50"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function InputField({
  disabled,
  label,
  onChange,
  value,
  ...props
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-asphalt-800">
      {label}
      <input
        className="focus-ring min-h-10 rounded-md border border-asphalt-300 bg-white px-3 text-sm text-asphalt-900 disabled:bg-asphalt-50"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function LoadingState() {
  return (
    <div className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">
      <div className="flex items-center gap-2">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        Manuelle Eingabe wird geladen.
      </div>
    </div>
  );
}

function UnauthorizedState() {
  return (
    <MessageBox
      icon={<Lock aria-hidden className="h-5 w-5" />}
      tone="neutral"
      title="Anmeldung erforderlich"
      message="Manuelle Eingaben sind nur fuer angemeldete Vereinsmitglieder moeglich."
      action={
        <Link
          href="/login"
          className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md bg-asphalt-900 px-3 text-sm font-semibold text-white"
        >
          Zur Anmeldung
        </Link>
      }
    />
  );
}

function MessageBox({
  action,
  icon,
  message,
  title,
  tone,
}: {
  action?: React.ReactNode;
  icon: React.ReactNode;
  message: string;
  title: string;
  tone: "neutral" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5 shadow-line",
        tone === "neutral" && "border-asphalt-200 bg-white text-asphalt-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "danger" && "border-red-200 bg-red-50 text-red-900",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5">{icon}</span>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm leading-6">{message}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}

function statusTone(status: ManualEntryOption["status"]) {
  switch (status) {
    case "open":
      return "success";
    case "used":
      return "warning";
    case "closed":
      return "neutral";
  }
}

function statusLabel(status: ManualEntryOption["status"]) {
  switch (status) {
    case "open":
      return "Offen";
    case "used":
      return "Bereits erfasst";
    case "closed":
      return "Geschlossen";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}
