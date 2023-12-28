// @ts-nocheck
//Gaussian function for 2 dimensions i and j. Based on the equation 

import { getImage2DDimensions } from './image2d.js';

//obtained from ~11:00 in the video : https://youtu.be/-LD9MxBUFQo?si=r08BmDOgvnhEcofy
function gaussian2D(i, j, sigma) {
  return Math.exp((((i * i) + (j * j)) / (sigma * sigma)) * -0.5) / (2 * Math.PI * (sigma * sigma));
}




//Builds a gaussian kernel matrix using the specified `kernel_size`
//and `sigma` value. Returns an array with the following schema:
//[
//  [...],
//  [...],
//   ...
//  [...],
//]
function buildGaussianKernel(kernel_size, sigma) {
  //Since the gaussian function produces values centered on 0 of the
  //x and y axis, I need to shift the gaussian function by half of the
  //kernel size to center it in the kernel matrix.
  const gaussian_shift = Math.floor(kernel_size / 2);
  const kernel = [];
  let sum = 0;


  //Build the kernel using the gaussian function.
  for (let i = 0 - gaussian_shift; i < kernel_size - gaussian_shift; i++) {
    const kernel_row = [];

    for (let j = 0 - gaussian_shift; j < kernel_size - gaussian_shift; j++) {
      //Sample the gaussian function at this i, j.
      const g_ij = gaussian2D(i, j, sigma);


      //Accumulate the value to a variable which will be used to normalize
      //the gaussian function to a sum of 1 later.
      sum += g_ij;


      //Push the value to the kernel row's column.
      kernel_row.push(g_ij);
    }

    kernel.push(kernel_row);
  }


  //Normalize the kernel using the sum calculated in the earlier step.
  for (let i = 0; i < kernel_size; i++) {
    for (let j = 0; j < kernel_size; j++) {
      kernel[i][j] = kernel[i][j] / sum;
    }
  }


  return kernel;
}




//Generates an odd numbered kernel size from a specified sigma value
//by taking 3 standard deviations of the gaussian function which should
//correspond to ~99.7% of the normal distribution. Then doubling it
//to cover both sides of the distribution and adding 1 to make the 
//kernel odd.
export function generateKernelSizeFromSigma(sigma) {
  return 2 * Math.round(3 * sigma) + 1;
}




/**
 * IMAGE PROCESSING INPUT/OUTPUT
 * 
 * METHOD 1 : Takes input_image_2d & output_image_2d, returns void
 * 
 *  PROS
 *    - image_2d input & output are stored on the worker thread, to
 *      update canvas and append to image stack, it avoids the overhead
 *      of creating a temporary image on the main thread and then doing
 *      another loop to update those values in the chunk, then appending
 *      that to the image stack at the end.
 * 
 *  CONS
 *    - Might have to pass the entire output image back to the main thread
 *      in order to update the canvas. Although this can be mitigated by
 *      having the function mutate the output image and also return a copy
 *      of the chunk that it processes. But this results in duplicated data.
 * 
 * METHOD 2 : Takes input_image_2d only, returns the blurred chunk_image_2d
 * 
 *  PROS
 *    - Reduces overhead on the background thread. All it does is process the
 *      image and return the result. 
 *    - Simple and intuitive behavior.
 * 
 *  CONS
 *    - Will need to either update values on a output_image_2d on the main thread
 *      before converting to ImageData or only convert the returned chunk to an
 *      ImageData then paint the canvas and obtain the blurred image_2d by converting
 *      the canvas's ImageData. The only issue with this is it relies on the canvas
 *      and might potentially reintroduce the chunking artefacts problem from earlier.
 * 
 * CONCLUSION 
 * 
 * I'll go with method 1, have the background thread do the heavy lifting, and
 * then keep the input and output image_2d in the background thread.
 * 
 * Processing functions mutate the output image and returns an image_2d of the
 * chunk that it processed.
 * 
 * This chunk is converted into an ImageData object and passed back to the main
 * thread for it to be painted on the canvas. 
 * 
 * Finally when all the chunks are processed, the main thread requests the full
 * output_image_2d from the background thread to repaint the entire canvas as
 * well as store it in the Octave's image_stack.
 */
export function blurChunk2D(input_image_2d, output_image_2d, chunk_boundary, sigma) {

  //First, build the gaussian kernel to convolve the image with as well
  //as calculate the kernel shift amount.
  const kernel_size = generateKernelSizeFromSigma(sigma);
  const kernel = buildGaussianKernel(kernel_size, sigma);
  const kernel_shift = Math.floor(kernel_size / 2);


  //Then, declare the chunk's output image_2d array and get the dimensions of
  //the input image_2d.
  const chunk_image_2d = [];
  const [width, height] = getImage2DDimensions(input_image_2d);


  //Now I convolve the image_data with the kernel, since the gaussian
  //kernel is going to be the same if I flip it horizontally and vertically,
  //I skip this step. But traditionally the kernel is flipped in both 
  //directions when doing 2D convolutions.
  for (let y = chunk_boundary.y1; y < chunk_boundary.y2; y++) {
    const output_row = [];

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
          else if (_x >= width) _x = width - 1;
          if (_y < 0) _y = 0;
          else if (_y >= height) _y = height - 1;


          //convolve the image with the kernel by first multiplying 
          //the pixel lined up with the kernel cell and adding it to 
          //a sum value.
          pixel_sum += input_image_2d[_y][_x] * kernel[i][j];


          //This is done for all pixels that are lined up with the 
          //kernel.
        }
      }


      //Push the pixel sum onto the output row for the chunk's output 
      //image 2d and also mutate the output_image_2d for the background
      //thread.
      output_image_2d[y][x] = pixel_sum;
      output_row.push(pixel_sum);
    }


    //Push the output row on the output image 2d array.
    chunk_image_2d.push(output_row);
  }


  //Returns an image_2d of the blurred chunk
  return chunk_image_2d;
}