import { getImage2DDimensions } from './image2d.js';

export function getPotentialKeypoints(image_trio) {
  const [width, height] = getImage2DDimensions(image_trio[0]);


  /**
   * [0][1][2][3][4][5][6][7][8][9]
   */
  for (let y = 1; y < height - 2; y += 3) {

    for (let x = 1; x < width - 2; x += 3) {
      console.log(x);
    }
  }
}