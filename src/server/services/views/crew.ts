import "server-only";
import { CATEGORIES } from "@/domain/categories";
import { placeName } from "@/domain/place-name";
import { tasteMatch } from "@/domain/taste";
import type { Db } from "../../db/client";
import { crewOf, isAdmin, listDevices, ownsCrew, type Session } from "../auth";
import { ownedCrewsWithOthers } from "../../repos/crews";
import { listMembers } from "../../repos/members";
import type { CrewData } from "../crew";
import { openReports } from "../moderation";

/* The Crew screen: members, your account and your phones. */

/** A report waiting on you, as the crew's owner (or the app admin, for owners' posts). */
export interface ReportView {
  id: string;
  /** Set when it's from another crew (the admin's reports about owners). */
  otherCrew: string | null;
  author: string;
  /** The author runs that crew, so only hide and dismiss apply. */
  authorIsOwner: boolean;
  /** Null once the reporter has deleted their account. */
  reporter: string | null;
  reason: string;
  at: string;
  kind: "review" | "checkin";
  place: string;
  hotTake: string | null;
  body: string | null;
  photoUrl: string | null;
  note: string | null;
}

export interface CrewView {
  /** The crew you're looking at, and every crew you're in (for the switcher). */
  crew: { id: string; name: string };
  crews: { id: string; name: string }[];
  /** This crew's invite code, for its /join/<code> link. */
  inviteCode: string;
  me: {
    id: string;
    name: string;
    /** Owner of this crew. */
    isOwner: boolean;
    hasPassword: boolean;
    /** Owns some crew with other people in it: must hand it over before deleting the account. */
    mustHandOver: boolean;
  };
  /** App admin: the building admin (/admin/stations) and recovery links. */
  isAdmin: boolean;
  /** This crew's other members, for the owner's hand-over. Empty for non-owners. */
  members: { id: string; name: string }[];
  /** Reports waiting on you. Empty unless you own this crew or are the app admin. */
  reports: ReportView[];
  /** Everyone in every crew, for the admin's recovery links. Empty for non-admins. */
  recoveryMembers: { id: string; name: string }[];
  devices: { id: string; label: string; lastSeenAt: string; current: boolean }[];
  leaderboard: {
    memberId: string;
    name: string;
    stations: number;
    reviews: number;
    checkins: number;
    hotTake: string | null;
  }[];
  /** How your scores compare with each friend's, best match first. */
  taste: {
    memberId: string;
    name: string;
    shared: number;
    agreement: number;
    closest: string;
    furthest: { label: string; gap: number } | null;
  }[];
}

export async function crewView(crew: CrewData, db: Db, session: Session): Promise<CrewView> {
  const current = crewOf(session);
  const devices = await listDevices(db, session);
  const board = crew.members.map((m) => {
    const rs = crew.reviews.filter((r) => r.memberId === m.id);
    const cs = crew.checkins.filter((c) => c.memberId === m.id);
    const hot = [...rs]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .find((r) => r.hotTake);
    return {
      memberId: m.id,
      name: m.name,
      stations: new Set([...rs, ...cs].map((v) => v.stationSlug)).size,
      reviews: rs.length,
      checkins: cs.length,
      hotTake: hot?.hotTake ?? null,
    };
  });
  const label = (key: string) => CATEGORIES.find((c) => c.key === key)!.label;
  const mine = crew.reviews.filter((r) => r.memberId === session.member.id);
  const taste = crew.members
    .filter((m) => m.id !== session.member.id)
    .flatMap((m) => {
      const t = tasteMatch(
        mine,
        crew.reviews.filter((r) => r.memberId === m.id),
      );
      if (t.agreement === null || !t.closest) return [];
      return [
        {
          memberId: m.id,
          name: m.name,
          shared: t.shared,
          agreement: t.agreement,
          closest: label(t.closest),
          furthest: t.furthest && { label: label(t.furthest.key), gap: t.furthest.gap },
        },
      ];
    })
    .sort((a, b) => b.agreement - a.agreement || a.name.localeCompare(b.name));
  const admin = isAdmin(session);
  const reports = (await openReports(db, session)).map((r): ReportView => ({
    id: r.id,
    otherCrew: r.crewId === current.id ? null : r.crewName,
    author: r.authorName,
    authorIsOwner: r.authorOwnsCrew,
    reporter: r.reporterName,
    reason: r.reason,
    at: r.createdAt.toISOString(),
    kind: r.kind,
    place: placeName(r.station),
    hotTake: r.hotTake,
    body: r.body,
    photoUrl: r.photoUrl,
    note: r.note,
  }));
  return {
    crew: { id: current.id, name: current.name },
    crews: session.crews.map((c) => ({ id: c.id, name: c.name })),
    inviteCode: current.inviteCode,
    taste,
    me: {
      id: session.member.id,
      name: session.member.name,
      isOwner: ownsCrew(session),
      hasPassword: session.member.hasPassword,
      mustHandOver: (await ownedCrewsWithOthers(db, session.member.id)).length > 0,
    },
    isAdmin: admin,
    members: ownsCrew(session) ? crew.members.filter((m) => m.id !== session.member.id) : [],
    reports,
    recoveryMembers: admin ? (await listMembers(db)).filter((m) => m.id !== session.member.id) : [],
    devices: devices.map((d) => ({
      id: d.id,
      label: d.label,
      lastSeenAt: d.lastSeenAt.toISOString(),
      current: d.current,
    })),
    leaderboard: board
      .filter((b) => b.stations > 0)
      .sort(
        (a, b) => b.stations - a.stations || b.reviews - a.reviews || a.name.localeCompare(b.name),
      ),
  };
}
