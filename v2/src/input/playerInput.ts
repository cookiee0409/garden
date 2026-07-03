export const virtualMove = {
  x: 0,
  z: 0,
};

export const virtualInteraction = {
  requestId: 0,
};

export function setVirtualMove(x: number, z: number): void {
  virtualMove.x = Math.max(-1, Math.min(1, x));
  virtualMove.z = Math.max(-1, Math.min(1, z));
}

export function requestVirtualInteraction(): void {
  virtualInteraction.requestId += 1;
}
