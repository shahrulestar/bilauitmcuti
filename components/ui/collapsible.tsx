"use client"

import * as React from "react"
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

import { cn } from "@/lib/utils"

const PROGRAM_DRAWER_COLLAPSIBLE_KEY = "program-drawer-collapsible-open"
const CALENDAR_DRAWER_COLLAPSIBLE_KEY = "calendar-drawer-collapsible-open"

function readPersistedOpen(storageKey: string, defaultOpen: boolean): boolean {
  if (typeof window === "undefined") return defaultOpen
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === null) return defaultOpen
    return stored === "true"
  } catch {
    return defaultOpen
  }
}

function writePersistedOpen(storageKey: string, open: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(storageKey, String(open))
  } catch {
    // ignore quota / private mode
  }
}

function usePersistedCollapsibleOpen(
  storageKey: string,
  defaultOpen = true
): [boolean, (open: boolean) => void] {
  const [open, setOpen] = React.useState(() =>
    readPersistedOpen(storageKey, defaultOpen)
  )

  React.useEffect(() => {
    setOpen(readPersistedOpen(storageKey, defaultOpen))
  }, [storageKey, defaultOpen])

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next)
      writePersistedOpen(storageKey, next)
    },
    [storageKey]
  )

  return [open, onOpenChange]
}

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

interface PersistedCollapsibleProps
  extends Omit<
    React.ComponentProps<typeof CollapsiblePrimitive.Root>,
    "open" | "onOpenChange" | "defaultOpen"
  > {
  storageKey: string
  defaultOpen?: boolean
}

function PersistedCollapsible({
  storageKey,
  defaultOpen = true,
  ...props
}: PersistedCollapsibleProps) {
  const [open, onOpenChange] = usePersistedCollapsibleOpen(
    storageKey,
    defaultOpen
  )
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} {...props} />
  )
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  )
}

function CollapsibleContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      className={cn(
        "overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200 ease-out motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  PersistedCollapsible,
  usePersistedCollapsibleOpen,
  PROGRAM_DRAWER_COLLAPSIBLE_KEY,
  CALENDAR_DRAWER_COLLAPSIBLE_KEY,
}
