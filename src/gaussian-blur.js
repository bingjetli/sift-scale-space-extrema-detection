// @ts-nocheck
//Gaussian function for 2 dimensions i and j. Based on the equation 

import { getPixelFromImageData, setPixelForImageData } from './image.js';

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




export function applyGaussianBlur(
  image_data,
  kernel_size = 0,
  sigma,
  offset_x1 = 0,
  offset_y1 = 0,
  offset_x2 = 0,
  offset_y2 = 0,
) {
  const kernel = buildGaussianKernel(kernel_size, sigma);
  const kernel_shift = Math.floor(kernel_size / 2);


  //Setup a blank image data object using the offscreen canvas to 
  //output the result to.
  //const _w = Math.abs(offset_x1) + Math.abs(offset_x2);
  //const _h = Math.abs(offset_y1) + Math.abs(offset_y2);
  //const output = new OffscreenCanvas(
  //  image_data.width - _w, image_data.height - _h
  //).getContext('2d').createImageData(image_data.width - _w, image_data.height - _h);
  const offscreen_canvas_context = new OffscreenCanvas(image_data.width, image_data.height).getContext('2d');
  const output = offscreen_canvas_context.createImageData(image_data.width, image_data.height);


  //Now I convolve the image_data with the kernel, since the gaussian
  //kernel is going to be the same if I flip it horizontally and vertically,
  //I skip this step. But traditionally the kernel is flipped in both 
  //directions when doing 2D convolutions.
  for (
    let y = (0 + offset_y1);
    y < (image_data.height + offset_y2);
    y++
  ) {
    for (
      let x = (0 + offset_x1);
      x < (image_data.width + offset_x2);
      x++
    ) {
      //For this image pixel, I center the kernel over it, multiply by 
      //the kernel values, then add them all together and set the new 
      //pixel value.
      const pixel_sum = [0, 0, 0, 255];
      for (let i = 0; i < kernel_size; i++) {
        for (let j = 0; j < kernel_size; j++) {
          //Calculate the x and y values to use for sampling the image.
          let _x = x + (i - kernel_shift);
          let _y = y + (j - kernel_shift);


          //Clamp the values within the image so this preserves the 
          //average brightness of the pixel and also reduces chunking
          //artifacts and black borders.
          //if (_x < 0) _x = 0;
          //else if (_x >= image_data.width) _x = image_data.width - 1;
          //if (_y < 0) _y = 0;
          //else if (_y >= image_data.height) _y = image_data.height - 1;


          //Mirror the values instead
          //if(_x < 0){
          //  //Check if the kernel shift is larger than the image size,
          //  //if it is, then floor divide it to get the value that
          //  //determines which direction to flip the image, then 
          //  //shift the image by the remainder of the division multiplied
          //  //by the direction coefficient.

          //  //This should give :
          //  // 0 : -1
          //  // 1 : 1
          //  // 2 : -1
          //  // 3 : 1
          //  // ...
          //  if(kernel_shift > image_data.width){
          //    //Calculate the direction coefficient, this should be either
          //    //0 if the kernel shift can be evenly divided by the image
          //    //width; or 1 if the kernel shift divides into an odd number.
          //    const direction_coefficient = Math.floor(kernel_shift / image_data.width) % 2;
          //    _x = 

          //  }
          //}


          //Lazy mirroring, since if the kernel size is greater than the
          //image, it will just be resampling the entire image over and
          //over again anyway.
          _x = x + (i - (kernel_shift % image_data.width));
          _y = y + (j - (kernel_shift % image_data.height));
          if (_x < 0) _x *= -1;
          else if (_x >= image_data.width) {
            const excess = _x - image_data.width;
            _x -= excess;
          }
          if (_y < 0) _y *= -1;
          else if (_y >= image_data.height) {
            const excess = _y - image_data.height;
            _y -= excess;
          }


          //Get the pixel for this specified x and y
          const pixel = getPixelFromImageData(image_data, _x, _y);


          //If there is no pixel here, skip it and move to the next.
          if (pixel === null) continue;


          //convolve the image with the kernel by first multiplying 
          //the pixel lined up with the kernel cell and adding it to 
          //a sum value.
          pixel_sum[0] += pixel[0] * kernel[i][j];
          pixel_sum[1] += pixel[1] * kernel[i][j];
          pixel_sum[2] += pixel[2] * kernel[i][j];


          //This is done for all pixels that are lined up with the 
          //kernel.
        }
      }


      //Now that the convolution step is finished, I set the pixel data
      //on the output image_data object.
      setPixelForImageData(output, x, y, pixel_sum);
    }
  }


  //Now the output image should contain a blur only at the area 
  //specified by the offset.
  offscreen_canvas_context.putImageData(output, 0, 0);
  return offscreen_canvas_context.getImageData(
    offset_x1,
    offset_y1,
    (image_data.width + offset_x2) - offset_x1,
    (image_data.height + offset_y2) - offset_y1,
  );
}




//Generates an odd numbered kernel size from a specified sigma value
//by taking 3 standard deviations of the gaussian function which should
//correspond to ~99.7% of the normal distribution. Then doubling it
//to cover both sides of the distribution and adding 1 to make the 
//kernel odd.
export function generateKernelSizeFromSigma(sigma) {
  return 2 * Math.round(3 * sigma) + 1;
}