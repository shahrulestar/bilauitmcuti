"use client"

import * as React from "react"
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

interface CollapsibleContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

function useCollapsibleContext() {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) throw new Error("Collapsible components must be used within Collapsible")
  return ctx
}

interface CollapsibleProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

function Collapsible({ open, onOpenChange, children, className }: CollapsibleProps) {
  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange }}>
      <div
        data-slot="collapsible"
        data-state={open ? "open" : "closed"}
        className={className}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface PersistedCollapsibleProps
  extends Omit<CollapsibleProps, "open" | "onOpenChange"> {
  storageKey: string
  defaultOpen?: boolean
}

function PersistedCollapsible({
  storageKey,
  defaultOpen = true,
  ...props
}: PersistedCollapsibleProps) {
  const [open, onOpenChange] = usePersistedCollapsibleOpen(storageKey, defaultOpen)
  return <Collapsible open={open} onOpenChange={onOpenChange} {...props} />
}

interface CollapsibleTriggerProps extends React.ComponentProps<"button"> {
  asChild?: boolean
}

function CollapsibleTrigger({ asChild, children, onClick, ...props }: CollapsibleTriggerProps) {
  const { open, onOpenChange } = useCollapsibleContext()

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented) onOpenChange(!open)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLButtonElement> }>,
      {
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          handleClick(event)
          ;(children as React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLButtonElement> }>).props.onClick?.(event)
        },
      }
    )
  }

  return (
    <button type="button" data-slot="collapsible-trigger" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

function CollapsibleContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { open } = useCollapsibleContext()
  if (!open) return null
  return (
    <div
      data-slot="collapsible-content"
      data-state="open"
      className={cn(
        "overflow-hidden animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
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
