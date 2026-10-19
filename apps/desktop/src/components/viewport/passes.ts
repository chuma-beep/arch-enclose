// Pictures of the view that are drawn only to be read from, for something laid over it:
// where the parts picked out together are, the light going across those being worked
// on, the lines of a reference scene. What is laid over the view is worked out at every
// one of the view's pixels, and reads the picture between its pixels where it has to;
// the picture itself need not have as many.

/**
 * The most pixels such a picture has to each pixel of the window, as the system counts
 * them. A Retina screen draws the view at two: at one and a half the picture has a
 * little over half as many pixels to draw, each four times over to keep its edges
 * smooth, and the lines laid over the view from it come out alike.
 */
export const PASS_RATIO = 1.5

/**
 * The size to draw such a picture at, for a view drawn `width` by `height` pixels at
 * `ratio` of them to each pixel of the window.
 */
export function passSize(
  width: number,
  height: number,
  ratio: number
): [number, number] {
  const scale = Math.min(1, PASS_RATIO / ratio)
  return [
    Math.max(1, Math.round(width * scale)),
    Math.max(1, Math.round(height * scale)),
  ]
}
