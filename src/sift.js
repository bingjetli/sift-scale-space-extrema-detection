//@ts-nocheck
'use strict';

import { Matrix2D_build, Matrix2D_getDimensions } from './matrix2d.js';


/**
 * This file contains SIFT specific helper functions.
 */




/**
 * 
 * @param {int} i 
 * @param {int} j 
 * @param {float} sigma 
 * @returns The discrete value of the Gaussian Function at `i` and `j`
 * with the sigma value `sigma`.
 */
function sample2DGaussian(i, j, sigma) {

  //obtained from ~11:00 in the video : https://youtu.be/-LD9MxBUFQo?si=r08BmDOgvnhEcofy
  return Math.exp((((i * i) + (j * j)) / (sigma * sigma)) * -0.5) / (2 * Math.PI * (sigma * sigma));
}




function buildGaussianKernel(sigma) {

  //Generates an odd numbered kernel size from a specified sigma value
  //by taking 3 standard deviations of the gaussian function which should
  //correspond to ~99.7% of the normal distribution. Then doubling it
  //to cover both sides of the distribution and adding 1 to make the 
  //kernel odd.
  const kernel_size = 2 * Math.round(3 * sigma) + 1;


  //Since the gaussian function produces values centered on 0 of the
  //x and y axis, I need to shift the gaussian function by half of the
  //kernel size to center it in the kernel matrix.
  const offset = Math.round(3 * sigma);
  let sum = 0;


  const kernel = Matrix2D_build(kernel_size, kernel_size, (i, j) => {

    //Sample the Gaussian function at the specified `i` and `j`,
    //accumulate the value, and return the value to be set in this matrix.
    const gaussian_value = sample2DGaussian(i - offset, j - offset, sigma);
    sum += gaussian_value;
    return gaussian_value;
  });


  //Normalize the kernel using the sum calculated in the earlier step.
  for (let i = 0; i < kernel_size; i++) {
    for (let j = 0; j < kernel_size; j++) {
      kernel[i][j] = kernel[i][j] / sum;
    }
  }


  return kernel;
}




export function SIFT_blurMatrix2DChunk(
  input,
  output,
  sigma,
  chunk_boundary,
) {

  //First, build the gaussian kernel to convolve the image with as well
  //as calculate the kernel shift amount.
  const kernel = buildGaussianKernel(sigma);
  const kernel_size = kernel.length;
  const kernel_shift = Math.floor(kernel_size / 2);


  //Then, declare the chunk's output Matrix2D and get the dimensions of
  //the input matrix.
  const chunk_matrix = [];
  const [rows, columns] = Matrix2D_getDimensions(input);


  //Now I convolve the image_data with the kernel, since the gaussian
  //kernel is going to be the same if I flip it horizontally and vertically,
  //I skip this step. But traditionally the kernel is flipped in both 
  //directions when doing 2D convolutions.
  for (let y = chunk_boundary.y1; y < chunk_boundary.y2; y++) {
    const chunk_matrix_row = [];

    for (let x = chunk_boundary.x1; x < chunk_boundary.x2; x++) {

      //For this image pixel, I center the kernel over it, multiply by 
      //the kernel values, then add them all together and set the new 
      //pixel value.
      let pixel_sum = 0;
      for (let i = 0; i < kernel_size; i++) {
        for (let j = 0; j < kernel_size; j++) {

          //Calculate the x and y values to use for sampling the image.
          let _x = x + (i - kernel_shift);
          let _y = y + (j - kernel_shift);


          //Clamp the values within the image so this preserves the 
          //average brightness of the pixel and removes black borders.
          //This also ensures pixels will always be inside the image.
          if (_x < 0) _x = 0;
          else if (_x >= columns) _x = columns - 1;
          if (_y < 0) _y = 0;
          else if (_y >= rows) _y = rows - 1;


          //convolve the image with the kernel by first multiplying 
          //the pixel lined up with the kernel cell and adding it to 
          //a sum value.
          pixel_sum += input[_y][_x] * kernel[i][j];


          //This is done for all pixels that are lined up with the 
          //kernel.
        }
      }


      //Push the pixel sum onto the output row for the chunk's output 
      //image 2d and also mutate the output_image_2d for the background
      //thread.
      output[y][x] = pixel_sum;
      chunk_matrix_row.push(pixel_sum);
    }


    //Push the output row on the output image 2d array.
    chunk_matrix.push(chunk_matrix_row);
  }


  //Returns the blurred chunk
  return chunk_matrix;
}




export function SIFT_subtractMatrix2DChunk(
  input_pair,
  output,
  chunk_boundary,
) {

  const chunk_matrix = [];


  for (let y = chunk_boundary.y1; y < chunk_boundary.y2; y++) {
    const chunk_matrix_row = [];


    for (let x = chunk_boundary.x1; x < chunk_boundary.x2; x++) {

      //Take the difference of the gaussian image pixel values and
      //store the result in the output_image_2d.
      //const difference = image2_2d[y][x] - image1_2d[y][x];
      const difference = input_pair[0][y][x] - input_pair[1][y][x];
      output[y][x] = difference;


      //Also push the result in the image row
      chunk_matrix_row.push(difference);
    }


    //Push that image row onto the chunk image 2d.
    chunk_matrix.push(chunk_matrix_row);
  }


  //Return the chunk image_2d array.
  return chunk_matrix;
}




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
export function SIFT_findExtremas(image_trio, scales_per_octave) {
  //const [width, height] = getImage2DDimensions(image_trio[0]);
  const [height, width] = Matrix2D_getDimensions(image_trio[0]);


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
        const pixel_threshold = (threshold * 0.8);
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