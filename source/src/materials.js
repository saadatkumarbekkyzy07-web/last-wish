// =====================================================================
//  APARTMENT COLOURS — copied from the Blender materials.
//  Blender's toon shaders can't be exported, so the game rebuilds them
//  here. Change a colour (r, g, b from 0 to 1) to repaint something.
// =====================================================================
export const MATERIAL_COLORS = {
  T_Wall: [0.95, 0.94, 0.91], T_Floor: [0.724, 0.563, 0.409], T_TileFloor: [0.2, 0.21, 0.19],
  T_TileWall_X: [0.87, 0.85, 0.79], T_TileWall_Y: [0.87, 0.85, 0.79], T_TileWall_Auto: [0.87, 0.85, 0.79],
  T_Blind: [0.45, 0.32, 0.25], T_Chrome: [0.7, 0.73, 0.78], T_Cream: [0.96, 0.88, 0.72],
  T_FurnWood: [0.86, 0.58, 0.28], T_FurnWoodDk: [0.86, 0.58, 0.28], T_DoorFrame: [0.92, 0.7, 0.45],
  T_Handle: [0.1, 0.1, 0.11], T_Ceramic: [0.96, 0.97, 0.98], T_Knob: [0.15, 0.13, 0.12],
  T_Hinge: [0.55, 0.53, 0.5], T_DoorWood: [0.84, 0.6, 0.34], T_CurtainBlue: [0.13, 0.23, 0.5],
  T_CurtainCream: [0.95, 0.92, 0.85], T_WinFrame: [0.3, 0.3, 0.32], T_DoorPlain: [0.9, 0.77, 0.58],
  T_TableWood: [0.86, 0.58, 0.28], T_WoodChair: [0.86, 0.58, 0.28], T_MatteBlack: [0.08, 0.08, 0.09],
  T_WindowDark: [0.14, 0.14, 0.15], T_Pillow: [0.98, 0.97, 0.95], T_SofaFabric: [0.18, 0.32, 0.62],
  T_Mattress: [0.97, 0.96, 0.93], T_VanityWood: [0.86, 0.6, 0.32], T_VanityWoodDk: [0.72, 0.48, 0.24],
  T_DuvetFold: [0.71, 0.58, 0.43], T_Duvet: [0.8, 0.68, 0.52], T_VentBack: [0.25, 0.18, 0.12],
  T_Chain: [0.9, 0.86, 0.75], T_DeskImported: [0.86, 0.58, 0.28], T_CeramicBowl: [0.82, 0.86, 0.9],
  T_Marble: [0.93, 0.86, 0.7], T_PanelCream: [0.93, 0.91, 0.86], T_RackMetal: [0.55, 0.53, 0.51],
  T_FridgeDoor: [0.27, 0.29, 0.34], T_FridgeBody: [0.22, 0.24, 0.28], T_CooktopRing: [0.3, 0.31, 0.34],
  T_KitchenCabinetCream: [0.97, 0.94, 0.86], T_KitchenCream: [0.95, 0.9, 0.78], T_Mirror: [0.82, 0.88, 0.94],
  T_ShelfBoard: [0.25, 0.26, 0.28], T_ShelfMetal: [0.16, 0.17, 0.19], T_MemoryBoard: [0.45, 0.36, 0.3],
  T_MemoryBoardEdge: [0.4, 0.3, 0.23], T_SofaWood: [0.86, 0.63, 0.38], T_ApplianceGlass: [0.2, 0.21, 0.24],
  T_ApplianceButton: [0.62, 0.64, 0.67], T_ApplianceBlack: [0.1, 0.1, 0.11], T_Carpet: [0.88, 0.8, 0.64],
  T_CarpetBorder: [0.74, 0.62, 0.45], T_NicheWood: [0.78, 0.53, 0.27], T_GamingChair: [0.22, 0.23, 0.27],
  T_PanelBreakers: [0.3, 0.31, 0.33], T_PanelDark: [0.09, 0.09, 0.1], T_IndicatorRed: [0.85, 0.15, 0.12],
  T_SteelBowl: [0.5, 0.52, 0.56], T_Steel: [0.72, 0.74, 0.77], T_DisplayScreen: [0.58, 0.64, 0.58],
  T_Grass: [0.42, 0.45, 0.18], T_FuRed: [0.92, 0.27, 0.12],
  // special ones
  T_Outline: [0.06, 0.04, 0.03], T_Ink: [0.07, 0.05, 0.04],
  T_KitchenGlass: [0.7, 0.86, 0.97], T_MirrorLamp: [1.0, 0.96, 0.82],
};
// these get a simple pattern so floors and tiles don't look flat
export const PATTERNS = {
  T_Floor: 'planks', T_TileFloor: 'tiles', T_TileWall_X: 'tiles', T_TileWall_Y: 'tiles', T_TileWall_Auto: 'tiles',
};
