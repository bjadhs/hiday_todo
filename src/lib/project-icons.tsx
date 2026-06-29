import {
  User, Briefcase, Monitor, Mail, FileText, Palette, Home, BookOpen,
  Target, Star, Flame, Heart, Zap, Globe, Coffee, Code, Rocket, Leaf, Sun, Gem,
  type LucideIcon,
} from "lucide-react"

export const PROJECT_ICON_NAMES = [
  "User", "Briefcase", "Monitor", "Mail", "FileText",
  "Palette", "Home", "BookOpen", "Target", "Star",
  "Flame", "Heart", "Zap", "Globe", "Coffee",
  "Code", "Rocket", "Leaf", "Sun", "Gem",
] as const

const iconRegistry: Record<string, LucideIcon> = {
  User, Briefcase, Monitor, Mail, FileText,
  Palette, Home, BookOpen, Target, Star,
  Flame, Heart, Zap, Globe, Coffee,
  Code, Rocket, Leaf, Sun, Gem,
}

export function ProjectIcon({ name, size, className }: { name: string; size?: number; className?: string }) {
  const Icon = iconRegistry[name]
  if (!Icon) return <span className={className} style={{ fontSize: size }}>{name}</span>
  return <Icon size={size ?? 16} className={className} />
}
