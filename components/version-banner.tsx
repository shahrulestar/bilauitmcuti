"use client"

import { useEffect, useState } from "react"

export function VersionBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    let hadController = !!navigator.serviceWorker.controller

    const handleControllerChange = () => {
      if (hadController) {
        setIsVisible(true)
      }
      hadController = true
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
    }
  }, [])

  useEffect(() => {
    if (!isVisible) return

    if (countdown <= 0) {
      window.location.reload()
      return
    }

    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [isVisible, countdown])

  if (!isVisible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-primary text-primary-foreground text-center text-sm py-2">
      New version available. Refreshing in {countdown}s...
    </div>
  )
}
