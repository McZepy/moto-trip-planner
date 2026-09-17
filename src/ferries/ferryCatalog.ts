import {
  FERRY_CATALOG_SEED,
} from './ferryCatalogSeed'

import type {
  FerryPort,
  FerryRoute,
  FerryService,
  FerryTerminal,
} from './ferryCatalogTypes'

export function getFerryCatalog() {
  return FERRY_CATALOG_SEED
}

export function getFerryPortById(
  id: string,
) {
  return (
    FERRY_CATALOG_SEED
      .ports
      .find(
        (port) =>
          port.id === id,
      ) ??
    null
  )
}

export function getFerryTerminalById(
  id: string,
) {
  return (
    FERRY_CATALOG_SEED
      .terminals
      .find(
        (terminal) =>
          terminal.id === id,
      ) ??
    null
  )
}

export function getFerryRouteById(
  id: string,
) {
  return (
    FERRY_CATALOG_SEED
      .routes
      .find(
        (route) =>
          route.id === id,
      ) ??
    null
  )
}

export function getFerryServicesForRoute(
  routeId: string,
) {
  return (
    FERRY_CATALOG_SEED
      .services
      .filter(
        (service) =>
          service.routeId ===
          routeId,
      )
  )
}

export function findFerryRoutesBetweenPorts(
  firstPortId: string,
  secondPortId: string,
) {
  return (
    FERRY_CATALOG_SEED
      .routes
      .filter(
        (route) =>
          (
            route.portAId ===
              firstPortId &&
            route.portBId ===
              secondPortId
          ) ||
          (
            route.bidirectional &&
            route.portAId ===
              secondPortId &&
            route.portBId ===
              firstPortId
          ),
      )
  )
}

export function findFerryRoutesForPort(
  portId: string,
) {
  return (
    FERRY_CATALOG_SEED
      .routes
      .filter(
        (route) =>
          route.portAId ===
            portId ||
          route.portBId ===
            portId,
      )
  )
}

function normalizeSearchText(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(
      /\p{Diacritic}/gu,
      '',
    )
    .toLocaleLowerCase()
    .trim()
}

export function searchFerryPorts(
  query: string,
) {
  const normalized =
    normalizeSearchText(
      query,
    )

  if (!normalized) {
    return []
  }

  return (
    FERRY_CATALOG_SEED
      .ports
      .filter(
        (port) => {
          const values = [
            port.name,
            ...(
              port.aliases ??
              []
            ),
          ]

          return values.some(
            (value) =>
              normalizeSearchText(
                value,
              ).includes(
                normalized,
              ),
          )
        },
      )
  )
}

export type FerryServiceView = {
  service:
    FerryService

  route:
    FerryRoute

  portA:
    FerryPort
  portB:
    FerryPort

  terminalA:
    FerryTerminal | null

  terminalB:
    FerryTerminal | null
}

export function listFerryServiceViews():
  FerryServiceView[] {
  const result:
    FerryServiceView[] = []

  for (
    const service
    of FERRY_CATALOG_SEED
      .services
  ) {
    const route =
      getFerryRouteById(
        service.routeId,
      )

    if (!route) {
      continue
    }

    const portA =
      getFerryPortById(
        route.portAId,
      )

    const portB =
      getFerryPortById(
        route.portBId,
      )

    if (
      !portA ||
      !portB
    ) {
      continue
    }

    const terminalA =
      service.terminalAId
        ? getFerryTerminalById(
            service
              .terminalAId,
          )
        : null

    const terminalB =
      service.terminalBId
        ? getFerryTerminalById(
            service
              .terminalBId,
          )
        : null

    result.push({
      service,
      route,
      portA,
      portB,
      terminalA,
      terminalB,
    })
  }

  return result
}

export function listRoutableFerryServices() {
  return listFerryServiceViews()
    .filter(
      (view) =>
        view.service
          .motorcycleAllowed !==
          false &&
        Boolean(
          view.terminalA
            ?.vehicleAccessPoint ??
            view.terminalA
              ?.terminalPoint,
        ) &&
        Boolean(
          view.terminalB
            ?.vehicleAccessPoint ??
            view.terminalB
              ?.terminalPoint,
        ),
    )
}
