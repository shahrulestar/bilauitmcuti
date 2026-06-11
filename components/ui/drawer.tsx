"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { useVisualViewportOffset } from "@/lib/use-visual-viewport-offset"
import { cn } from "@/lib/utils"

/** Shared shell: min 30dvh, max 80dvh (bottom); flex children use min-h-0 for inner scroll. */
export const drawerContentClassName =
  "flex min-h-[30dvh] flex-col [&::after]:hidden overflow-x-hidden"

/** Activity day list drawer — capped at 60dvh (bottom). */
export const activityDrawerContentClassName = cn(
  drawerContentClassName,
  "data-[vaul-drawer-direction=bottom]:max-h-[60dvh]"
)

/** Drawer body column that fills the shell (use with a scroll region below a fixed header). */
export const drawerBodyFlexClassName = "flex min-h-0 flex-1 flex-col"

/** Scrollable drawer region (list/content only — keep titles/headers outside). */
export const drawerScrollRegionClassName =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain"

/** Bottom inset: safe-area + 28px (1.75rem) for PWA home indicator — use on drawer shell. */
export const DRAWER_SAFE_BOTTOM_PADDING =
  "calc(env(safe-area-inset-bottom) + 1.75rem)" as const

export const drawerSafeAreaBottomClassName =
  "pb-[calc(env(safe-area-inset-bottom)+1.75rem)]"

export const drawerBodyClassName =
  "flex w-full min-w-0 max-w-full flex-col border-0 bg-popover px-4 pt-0 text-left shadow-none outline-none ring-0 ring-offset-0"

/** Pure white in light theme (see `.responsive-shell-bg` in globals.css). */
export const responsiveShellBgClassName = "responsive-shell-bg"

/** Drawer shell for mention picker & engagement prompt. */
export const responsiveDrawerContentClassName = cn(
  drawerContentClassName,
  responsiveShellBgClassName
)

/** Responsive shell for drawers with text inputs (engagement prompt, mention picker). */
export const responsiveKeyboardDrawerContentClassName = responsiveDrawerContentClassName

/** Pins bottom drawer to visible viewport above the mobile keyboard. */
export const keyboardAwareDrawerContentClassName =
  "data-[vaul-drawer-direction=bottom]:!bottom-[var(--vv-bottom-offset,0px)] data-[vaul-drawer-direction=bottom]:!max-h-[min(80dvh,calc(100dvh-var(--vv-bottom-offset,0px)))] data-[vaul-drawer-direction=bottom]:!h-auto"

/** Body layout for responsive drawer/dialog pairs (mention picker, engagement prompt). */
export const responsiveDrawerBodyClassName = cn(
  "gap-3 text-center md:text-left",
  responsiveShellBgClassName
)

/** Shared visible drawer heading — matches Program Selection drawer. */
export const drawerTitleClassName =
  "w-full border-0 text-center text-lg font-semibold leading-snug tracking-tight text-foreground shadow-none outline-none ring-0 ring-offset-0"

/** Dialog title/description typography aligned with drawer responsive pairs. */
export const responsiveDialogTitleClassName = drawerTitleClassName

export const responsiveDialogDescriptionClassName =
  "border-0 text-sm text-muted-foreground shadow-none text-center md:text-left"

export const responsiveDrawerDescriptionClassName =
  responsiveDialogDescriptionClassName

/** Full-width primary action — 38px tall (settings shell, drawers). */
export const drawerPrimaryButtonClassName =
  "w-full !h-[38px] justify-center border-border text-center transition-none"

/** Full-width outline action — 38px tall (settings shell, drawers). */
export const drawerOutlineButtonClassName =
  "w-full h-[38px] justify-center border-border bg-background text-black shadow-xs transition-all hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:text-foreground dark:hover:bg-input/50"

function Drawer({
  handleOnly = true,
  dismissible = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      handleOnly={handleOnly}
      dismissible={dismissible}
      {...props}
    />
  )
}

function KeyboardAwareDrawer({
  open,
  handleOnly = true,
  dismissible = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  useVisualViewportOffset(open === true)

  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      open={open}
      handleOnly={handleOnly}
      dismissible={dismissible}
      repositionInputs={false}
      {...props}
    />
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  keyboardAware = false,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  keyboardAware?: boolean
}) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto min-h-[30dvh] flex-col border-0 bg-popover text-sm text-popover-foreground shadow-none outline-none ring-0 ring-offset-0 data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80dvh] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80dvh] data-[vaul-drawer-direction=top]:rounded-b-xl data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          keyboardAware && keyboardAwareDrawerContentClassName,
          className
        )}
        {...props}
      >
        <DrawerPrimitive.Handle
          aria-hidden
          className="mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block"
        />
        <div
          data-vaul-no-drag=""
          className={cn(
            "flex min-h-0 w-full flex-1 flex-col pt-3",
            drawerSafeAreaBottomClassName
          )}
        >
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 border-0 border-b-0 p-4 shadow-none outline-none ring-0 ring-offset-0 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-0 border-t-0 p-4 shadow-none outline-none ring-0 ring-offset-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading", drawerTitleClassName, className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(
        "border-0 text-sm text-muted-foreground shadow-none outline-none ring-0 ring-offset-0",
        className
      )}
      {...props}
    />
  )
}

export {
  Drawer,
  KeyboardAwareDrawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
