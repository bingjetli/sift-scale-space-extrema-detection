import { getImage2DDimensions } from './image2d.js';

export function findDoGExtrema(image_trio) {
  const [width, height] = getImage2DDimensions(image_trio[0]);


  const candidate_keypoints = [];


  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      //Check the 26 neighbors of the center pixel to find local extrema.
      const center_pixel = image_trio[1][y][x];
      let is_minima = true;
      let is_maxima = true;
      const neighbors = [
        image_trio[1][y][x - 1],
        image_trio[1][y - 1][x - 1],
        image_trio[1][y - 1][x],
        image_trio[1][y - 1][x + 1],
        image_trio[1][y][x + 1],
        image_trio[1][y + 1][x + 1],
        image_trio[1][y + 1][x],
        image_trio[1][y + 1][x - 1],

        image_trio[0][y][x],
        image_trio[0][y][x - 1],
        image_trio[0][y - 1][x - 1],
        image_trio[0][y - 1][x],
        image_trio[0][y - 1][x + 1],
        image_trio[0][y][x + 1],
        image_trio[0][y + 1][x + 1],
        image_trio[0][y + 1][x],
        image_trio[0][y + 1][x - 1],

        image_trio[2][y][x],
        image_trio[2][y][x - 1],
        image_trio[2][y - 1][x - 1],
        image_trio[2][y - 1][x],
        image_trio[2][y - 1][x + 1],
        image_trio[2][y][x + 1],
        image_trio[2][y + 1][x + 1],
        image_trio[2][y + 1][x],
        image_trio[2][y + 1][x - 1],
      ];


      //Checks if every element is larger than the center pixel, if 
      //this is true, this means the center pixel is a minima.
      is_minima = neighbors.every(element => element > center_pixel);


      //Check if every neighboring element is smaller than the center
      //pixel, if this is true, this means the center pixel is a maxima.
      is_maxima = neighbors.every(element => element < center_pixel);


      //Check if this pixel is an extrema.
      if (is_minima || is_maxima) {

        //This pixel is an extrema.
        //console.log(`${is_maxima && !is_minima ? 'Maxima' : is_minima && !is_maxima ? 'Minima' : is_maxima && is_minima ? 'Maxima & Minima' : 'Neither'} : ${center_pixel}`);
        //console.log(neighbors);


        //Add the pixel coordinate to the candidate keypoints list.
        candidate_keypoints.push({
          x: x,
          y: y,
          pixelValue: center_pixel,
        });
      }
    }
  }


  return candidate_keypoints;
}




function isPixelAnExtremum(bot_layer, mid_layer, top_layer) {

}