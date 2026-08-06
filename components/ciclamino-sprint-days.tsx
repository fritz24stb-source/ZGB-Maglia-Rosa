import Link from "next/link";
import { ChevronDown, Clock3, Pencil, Swords, Trash2, UsersRound } from "lucide-react";
import { CICLAMINO_LOCATIONS } from "@/lib/classifications/ciclamino";
import type { CiclaminoSprintDay } from "@/lib/classifications/types";

export function CiclaminoSprintDays({ editable = false, sprintDays }: { editable?: boolean; sprintDays: CiclaminoSprintDay[] }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold text-asphalt-900">Angelegte Sprinttage</h2>
      {sprintDays.length === 0 ? (
        <p className="rounded-lg border border-asphalt-200 bg-white p-5 text-sm text-asphalt-600 shadow-line">Noch keine Ciclamino-Sprints erfasst.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-asphalt-200 bg-white shadow-line">
          <div className="hidden grid-cols-[10rem_minmax(0,1fr)_10rem_minmax(12rem,1fr)_2.5rem] gap-3 bg-asphalt-50 px-4 py-3 text-xs font-semibold uppercase text-asphalt-600 md:grid">
            <span>Datum</span><span>Saison</span><span>Ortsschilder</span><span>Most Combative Rider</span><span aria-hidden />
          </div>
          <div className="divide-y divide-asphalt-100">
            {sprintDays.map((day) => (
              <details key={day.key} className="group">
                <summary className="focus-ring grid min-h-14 cursor-pointer list-none grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden md:grid-cols-[10rem_minmax(0,1fr)_10rem_minmax(12rem,1fr)_2.5rem]">
                  <span className="font-semibold text-asphalt-900">{formatDate(day.sprintDate)}</span>
                  <span className="text-asphalt-600">{day.seasonName}</span>
                  <span className="hidden text-asphalt-600 md:block">{day.sprints.length} von 3</span>
                  <span className="hidden font-medium text-fuchsia-800 md:block">{day.combativeRider ? `${day.combativeRider.displayName} (+5 P)` : resultStatus(day)}</span>
                  <ChevronDown aria-hidden className="h-5 w-5 justify-self-end text-asphalt-500 transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-asphalt-100 bg-asphalt-50/50 p-4">
                  <div className="mb-4 flex items-center gap-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3 text-sm">
                    <Swords aria-hidden className="h-5 w-5 shrink-0 text-fuchsia-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase text-fuchsia-700">Most Combative Rider</p>
                      <p className="mt-0.5 font-semibold text-asphalt-900">{day.combativeRider ? `${day.combativeRider.displayName} · +${day.combativeRider.points} Punkte` : resultStatus(day)}</p>
                      {day.combativeSource ? <p className="mt-1 text-xs text-asphalt-600">Quelle: {day.combativeSource === "admin_override" ? "Admin-Override" : "Abstimmung"}</p> : null}
                    </div>
                  </div>

                  {editable ? <VotingDetails day={day} /> : null}

                  <div className="grid gap-4 lg:grid-cols-3">
                    {CICLAMINO_LOCATIONS.map((location) => {
                      const sprint = day.sprints.find((candidate) => candidate.name === location);
                      return (
                        <section key={location} className="rounded-lg border border-fuchsia-100 bg-white p-4">
                          <h3 className="font-semibold text-fuchsia-950">{location}</h3>
                          {sprint ? (
                            <ol className="mt-3 grid gap-2 text-sm">
                              {sprint.placements.map((placement) => (
                                <li key={placement.place} className="grid grid-cols-[2rem_minmax(0,1fr)_3rem] gap-2">
                                  <span className="font-semibold">{placement.place}.</span><span>{placement.displayName}</span><span className="text-right font-semibold text-fuchsia-800">{placement.points} P</span>
                                </li>
                              ))}
                            </ol>
                          ) : <p className="mt-3 text-sm text-asphalt-500">Nicht erfasst</p>}
                        </section>
                      );
                    })}
                  </div>
                  {editable ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href={`/sprints?edit=${encodeURIComponent(day.key)}#sprint-form`} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-asphalt-900 px-4 text-sm font-semibold text-white"><Pencil aria-hidden className="h-4 w-4" /> Bearbeiten</Link>
                      <form action="/api/ciclamino/sprints" method="post">
                        <input type="hidden" name="action" value="delete" /><input type="hidden" name="seasonId" value={day.seasonId} /><input type="hidden" name="sprintDate" value={day.sprintDate} />
                        <button className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-medium text-red-800" type="submit"><Trash2 aria-hidden className="h-4 w-4" /> Sprinttag löschen</button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function VotingDetails({ day }: { day: CiclaminoSprintDay }) {
  return (
    <section className="mb-4 rounded-lg border border-asphalt-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Clock3 aria-hidden className="mt-0.5 h-4 w-4 text-asphalt-500" />
          <div><h3 className="text-sm font-semibold text-asphalt-900">Abstimmungszeitraum</h3><p className="mt-1 text-sm text-asphalt-600">{day.votingWindow ? `${formatDateTime(day.votingWindow.opensAt)} bis ${formatDateTime(day.votingWindow.closesAt)}` : "Noch nicht konfiguriert"}</p></div>
        </div>
        {day.votingWindow ? <span className="rounded-full bg-asphalt-100 px-2.5 py-1 text-xs font-semibold text-asphalt-700">{day.votingWindow.status === "open" ? "Offen" : day.votingWindow.status === "scheduled" ? "Geplant" : "Geschlossen"}</span> : null}
      </div>
      <div className="mt-4 flex items-center gap-2"><UsersRound aria-hidden className="h-4 w-4 text-fuchsia-700" /><h3 className="text-sm font-semibold text-asphalt-900">Stimmen</h3></div>
      {day.voteSummary.length ? (
        <div className="mt-3 grid gap-2">
          {day.voteSummary.map((candidate, index) => (
            <details key={candidate.candidateUserId} className="group rounded-md border border-asphalt-100 bg-asphalt-50">
              <summary className="focus-ring grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto_1.5rem] items-center gap-3 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-asphalt-900">{candidate.candidateDisplayName}</span><span className="font-semibold text-fuchsia-800">{candidate.voteCount} {candidate.voteCount === 1 ? "Stimme" : "Stimmen"}</span><span className="text-xs text-asphalt-600">{candidate.sprintPoints} Sprintpunkte</span><ChevronDown aria-hidden className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-asphalt-100 px-3 py-2 text-xs text-asphalt-600"><span className="font-semibold">Abgestimmt haben: </span>{candidate.voters.map((voter) => voter.displayName).join(", ")}</div>
              {index === 0 && day.votingWindow?.status === "closed" && !day.combativeRider ? <p className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Stimmen und Sprintpunkte sind gleich – Admin-Override erforderlich.</p> : null}
            </details>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-asphalt-500">Noch keine Stimmen abgegeben.</p>}
    </section>
  );
}

function resultStatus(day: CiclaminoSprintDay) {
  if (!day.votingWindow) return "Abstimmung nicht konfiguriert";
  if (day.votingWindow.status === "scheduled") return "Abstimmung noch nicht geöffnet";
  if (day.votingWindow.status === "open") return "Abstimmung läuft";
  if (!day.voteSummary.length) return "Keine Stimmen abgegeben";
  return "Gleichstand – Admin-Override erforderlich";
}

function formatDate(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value)); }
