"use client"

import { useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("pageshow", callback)
  return () => window.removeEventListener("pageshow", callback)
}

function getSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

export function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
