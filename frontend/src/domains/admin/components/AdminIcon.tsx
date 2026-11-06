import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  CircleHelp,
  Clock,
  GraduationCap,
  Inbox,
  KeyRound,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  PenLine,
  Receipt,
  Settings,
  SquarePlay,
  Star,
  Tag,
  User,
  Users,
} from "lucide-react";

import type { AdminIconName } from "../services/AdminNavigation";

/** The admin menu's icons: Lucide, like the rest of the site (docs/brand.md §6). */
const ICONS: Record<AdminIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  people: Users,
  clock: Clock,
  receipt: Receipt,
  inbox: Inbox,
  tag: Tag,
  question: CircleHelp,
  school: GraduationCap,
  book: BookOpen,
  user: User,
  pen: PenLine,
  star: Star,
  play: SquarePlay,
  chat: MessageSquare,
  gear: Settings,
  key: KeyRound,
  chart: ChartColumn,
};

export function AdminIcon({ name, className = "h-4 w-4" }: { name: AdminIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden strokeWidth={1.75} className={className} />;
}
