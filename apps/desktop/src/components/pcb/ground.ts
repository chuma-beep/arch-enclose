// What PCB mode and its drawings share: the ground a board is seen on, and how big a
// drawing of one is made.

/**
 * The ground the board's technical view is drawn on in the dark: KiCad's, a navy so deep
 * it is nearly black, which its layers' colours are chosen against (and which index.css
 * tints the cards over it with). Its 3D and its schematic are on the view's own ground,
 * as the model is, and so is all of it in the light.
 */
export const DARK_GROUND = "rgb(0, 16, 35)"

/** How big the drawings are made, in their own pixels: the view zooms in on them. */
export const DRAWN = { width: 1600, height: 1200 }
