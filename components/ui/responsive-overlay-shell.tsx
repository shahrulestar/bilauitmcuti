"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  responsiveDialogContentClassName,
} from "@/components/ui/dialog";
import {
  KeyboardAwareDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  drawerBodyClassName,
  drawerBodyFlexClassName,
  drawerScrollRegionClassName,
  responsiveDialogTitleClassName,
  responsiveDrawerBodyClassName,
  responsiveDrawerDescriptionClassName,
  responsiveKeyboardDrawerContentClassName,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveOverlayShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  scrollClassName?: string;
  desktopBodyClassName?: string;
}

export function ResponsiveOverlayShell({
  open,
  onOpenChange,
  isMobile,
  title,
  description,
  children,
  scrollClassName,
  desktopBodyClassName,
}: ResponsiveOverlayShellProps) {
  if (isMobile) {
    return (
      <KeyboardAwareDrawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent keyboardAware className={responsiveKeyboardDrawerContentClassName}>
          <div
            className={cn(
              drawerBodyClassName,
              drawerBodyFlexClassName,
              responsiveDrawerBodyClassName,
              "min-h-0 gap-0"
            )}
          >
            <div data-vaul-no-drag="" className="w-full shrink-0">
              <DrawerTitle>{title}</DrawerTitle>
              {description ? (
                <DrawerDescription className={responsiveDrawerDescriptionClassName}>
                  {description}
                </DrawerDescription>
              ) : null}
            </div>
            <div
              data-vaul-no-drag=""
              className={cn(drawerScrollRegionClassName, "w-full min-w-0", scrollClassName)}
            >
              {children}
            </div>
          </div>
        </DrawerContent>
      </KeyboardAwareDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={responsiveDialogContentClassName} showCloseButton={false}>
        <DialogHeader className="gap-3 text-center md:text-left">
          <DialogTitle className={responsiveDialogTitleClassName}>{title}</DialogTitle>
          {description ? (
            <DialogDescription className={responsiveDrawerDescriptionClassName}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {desktopBodyClassName ? (
          <div className={desktopBodyClassName}>{children}</div>
        ) : (
          children
        )}
      </DialogContent>
    </Dialog>
  );
}
