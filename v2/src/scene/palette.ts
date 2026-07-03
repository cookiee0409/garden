import type { SeasonId } from "../game/types";

export interface ScenePalette {
  background: string;
  gardenGrass: string;
  gardenSide: string;
  forestGrass: string;
  forestSide: string;
  treeDark: string;
  treeLight: string;
  trunk: string;
}

const DAY_PALETTES: Record<SeasonId, ScenePalette> = {
  spring: {
    background: "#e9f7ff",
    gardenGrass: "#86cf98",
    gardenSide: "#b07a53",
    forestGrass: "#63b874",
    forestSide: "#7b5a43",
    treeDark: "#559b66",
    treeLight: "#f3a8ba",
    trunk: "#8d6546",
  },
  summer: {
    background: "#dff4ec",
    gardenGrass: "#6fbd7f",
    gardenSide: "#a9724a",
    forestGrass: "#4fae68",
    forestSide: "#77573f",
    treeDark: "#3f8f54",
    treeLight: "#65b875",
    trunk: "#876043",
  },
  autumn: {
    background: "#fff0dc",
    gardenGrass: "#b7bf6f",
    gardenSide: "#a86845",
    forestGrass: "#9eb05b",
    forestSide: "#7a503c",
    treeDark: "#c07a3f",
    treeLight: "#e0a24c",
    trunk: "#7e563a",
  },
  winter: {
    background: "#e8f3ff",
    gardenGrass: "#bfd8d0",
    gardenSide: "#8f8d82",
    forestGrass: "#a8c5bd",
    forestSide: "#6c716d",
    treeDark: "#6c8f86",
    treeLight: "#dbefff",
    trunk: "#6f5d4e",
  },
};

const NIGHT_OVERRIDES: Record<SeasonId, Partial<ScenePalette>> = {
  spring: {
    background: "#1b263d",
    gardenGrass: "#4d806a",
    forestGrass: "#3f745b",
    treeLight: "#d98aa0",
  },
  summer: {
    background: "#17233b",
    gardenGrass: "#3f765e",
    forestGrass: "#356c53",
  },
  autumn: {
    background: "#211d31",
    gardenGrass: "#7a7349",
    forestGrass: "#74653b",
    treeLight: "#c7833f",
  },
  winter: {
    background: "#16243b",
    gardenGrass: "#8da8ad",
    forestGrass: "#78979b",
    treeLight: "#cce7ff",
  },
};

export function getScenePalette(season: SeasonId, night: boolean): ScenePalette {
  const base = DAY_PALETTES[season];
  return night ? { ...base, ...NIGHT_OVERRIDES[season] } : base;
}
