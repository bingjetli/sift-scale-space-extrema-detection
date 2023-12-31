//@ts-nocheck
'use strict';


import { getImage2DDimensions } from './image2d.js';

//Returns an object containing both the candidate keypoints found for
//this image trio as well as the rejected low contrast keypoints.
/**
 * The returned object has the following schema :
 * {
 *  candidateKeypoints : [e, e, ..., e],
 *  lowContrastKeypoints : [e, e, ..., e],
 * }
 * 
 * where `e` represents an extrema. 
 * 
 * 
 * An extrema has the following schema :
 * {
 *  x : Number
 *  y : Number
 *  value : Number
 * }
 */
export function findDoGExtrema(image_trio, scales_per_octave) {
  const [width, height] = getImage2DDimensions(image_trio[0]);


  const candidate_keypoints = [];
  const low_contrast_keypoints = [];


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
        //Create an object to store the extrema data.
        const extrema = {
          x: x,
          y: y,
          value: center_pixel,
        };


        //Filter out low contrast keypoints before adding it to the list
        //of candidate keypoints. There is a magic number threshold with 
        //the value `0.015` for `3` scales per octave. There is a way to
        //scale this value relative to the specified scales per octave.
        const threshold = ((Math.pow(2, 1 / scales_per_octave) - 1) / (Math.pow(2, 1 / 3) - 1)) * 0.015;


        //So now, if the difference of Gaussian value is less than this
        //specified threshold, it is discarded. What's interesting, is 
        //that the threshold is reduced even further by 80% in practice.
        //It seems that this is done to reduce the amount of unneccessary
        //computations and so a slightly more aggressive threshold is applied.
        //The values of the image range between 0-255, so we multiply
        //the calculated threshold by 255 to get the appropriate 
        //threshold value for this range.
        const pixel_threshold = (threshold * 0.8) * 255;
        console.log(pixel_threshold);
        if (Math.abs(center_pixel) >= pixel_threshold) {

          //If the difference of Gaussians at this location passes the
          //low contrast thresholding filter, we can then add this 
          //pixel coordinate to the candidate keypoints list.
          candidate_keypoints.push(extrema);
        }
        else {

          //This is a low contrast keypoint, so we can add it to the list
          //of rejected keypoints.
          low_contrast_keypoints.push(extrema);
        }
      }
    }
  }


  return {
    candidateKeypoints: candidate_keypoints,
    lowContrastKeypoints: low_contrast_keypoints,
  };
}




/**
 * This function takes a `matrix cube` in order to perform calculations.
 * It has the following schema :
 * [
 *  m,  -1
 *  m,   |
 *  m,   v
 * ]    +1
 *      (s)
 *
 *
 * where `m` is a Column-Major `Matrix` with the following schema :
 * [
 *  [p, p, p],  -1 ---> +1 (y)
 *  [p, p, p],   |
 *  [p, p, p],   v
 * ]            +1
 *              (x)
 *
 *
 * where `p` is an image pixel.
 */
//export function approximateGradientUsingFiniteDifferences(matrix_cube) {
//
//  //The calculations are done with the assumption that `m` correspond
//  //with the image x coordinate, and `n` correspond with the image y
//  //coordinate. Since matrices are implemented with a Column Major
//  //scheme, movement along the x axis corresponds to picking the
//  //column (j) in the matrix. Likewise, movement along the y-axis
//  //corresponds to picking the row (i) in the matrix.
//  return new Matrix(3, 1, MatrixDataType.FLOAT32)
//    .setValue(0, 0, (matrix_cube[2].getValue(1, 1) - matrix_cube[0].getValue(1, 1)) / 2)
//    .setValue(1, 0, (matrix_cube[1].getValue(1, 2) - matrix_cube[1].getValue(1, 0)) / 2)
//    .setValue(2, 0, (matrix_cube[1].getValue(2, 1) - matrix_cube[1].getValue(0, 1)) / 2);
//}