//@ts-nocheck
'use strict';


/**
 * This file contains functions used to process Matrix2D objects containing
 * image data as well as functions to convert between Matrix2D images 
 * and the native ImageData objects. Basically, anything involving
 * image processing but doesn't fit into Matrix2D specific processes or
 * SIFT specific processes.
 */


/**
 * 
 * @param {ImageData} imageData 
 * @param {bool} convertToGrayscale Default : false. 
 * @param {bool} usePerceptualGrayscale Default : false.
 * @param {bool} discardAlphaChannel Default: false.
 * @returns The specified image channels as `Matrix2D` objects. For 
 * example, if only the grayscale channel is specified, it returns only
 * the grayscale channel matrix. If the alpha channel is specified, it
 * returns [gray_channel, alpha_channel]. Likewise if the RGB channels 
 * are specified, it returns [red_channel, green_channel, blue_channel]
 * and the alpha channel last if that is specified.
 */
export function ImageUtils_convertImageDataToMatrix2D({
  imageData,
  convertToGrayscale = false,
  usePerceptualGrayscale = false,
  discardAlphaChannel = false,
}) {

  //Images are always converted to decimal representation.
  let gray_channel = null;
  let red_channel = null;
  let green_channel = null;
  let blue_channel = null;
  let alpha_channel = null;


  //Initialize the gray channel matrix if it's enabled, otherwise initialize
  //the RGB channel matrices.
  if (convertToGrayscale === true) {
    gray_channel = [];
  }
  else {
    red_channel = [];
    green_channel = [];
    blue_channel = [];
  }


  //Initialize the alpha channel matrix if it's enabled.
  if (discardAlphaChannel === false) {
    alpha_channel = [];
  }


  for (let y = 0; y < imageData.height; y++) {


    //If the alpha channel matrix is enabled, initialize the row array.
    let alpha_channel_row = null;
    if (discardAlphaChannel === false) alpha_channel_row = [];


    //If the gray channel matrix is enabled, initialize the gray channel's
    //row array. Otherwise, initialize the RGB channels' row arrays.
    let red_channel_row = null;
    let green_channel_row = null;
    let blue_channel_row = null;
    let gray_channel_row = null;
    if (convertToGrayscale === true) {
      gray_channel_row = [];
    }
    else {
      red_channel_row = [];
      green_channel_row = [];
      blue_channel_row = [];
    }


    for (let x = 0; x < imageData.width; x++) {

      //Now store a handle to the current pixel from the image data.
      const pixel = ImageUtils_getPixelFromImageData(imageData, x, y);


      //If the alpha channel is enabled, convert that pixel into a 
      //decimal and add it to the alpha channel row.
      if (discardAlphaChannel === false) {
        alpha_channel_row.push(pixel[3] / 255.0);
      }


      //If the grayscale channel is enabled, check if the function should
      //use the perceptual grayscale ratios or not and convert that pixel
      //into its respective grayscale decimal value before adding it to
      //the grayscale channel matrix row. Otherwise, add the respective
      //RGB decimal pixel to their channel rows.
      if (convertToGrayscale === true) {
        let grayscale_pixel_value = null;


        if (usePerceptualGrayscale === true) {
          grayscale_pixel_value = (pixel[0] * 0.299) + (pixel[1] * 0.587) + (pixel[2] * 0.114);
        }
        else {
          grayscale_pixel_value = (pixel[0] * 0.299) + (pixel[1] * 0.587) + (pixel[2] * 0.114);
        }


        gray_channel_row.push(grayscale_pixel_value / 255.0);
      }
      else {
        red_channel_row.push(pixel[0] / 255.0);
        green_channel_row.push(pixel[1] / 255.0);
        blue_channel_row.push(pixel[2] / 255.0);
      }
    }


    //If the alpha channel is enabled, add the accumulated row of pixels
    //to the matrix.
    if (discardAlphaChannel === false) {
      alpha_channel.push(alpha_channel_row);
    }


    //Likewise do the same for the RGB or Grayscale channels.
    if (convertToGrayscale === true) {
      gray_channel.push(gray_channel_row);
    }
    else {
      red_channel.push(red_channel_row);
      green_channel.push(green_channel_row);
      blue_channel.push(blue_channel_row);
    }
  }


  //Now return the appropriate matrices.
  if (discardAlphaChannel === false) {
    if (convertToGrayscale === true) return [gray_channel, alpha_channel];
    else return [red_channel, green_channel, blue_channel, alpha_channel];
  }
  else {
    if (convertToGrayscale === true) return gray_channel;
    else return [red_channel, green_channel, blue_channel];
  }
}




/**
 * 
 * @param {uint} width 
 * @param {uint} height 
 * @param {Matrix2D} redChannelMatrix
 * @param {Matrix2D} greenChannelMatrix
 * @param {Matrix2D} blueChannelMatrix
 * @param {Matrix2D} alphaChannelMatrix If this channel is omitted, the
 * image will have full opacity.
 * @param {Matrix2D} grayChannelMatrix If this is specified, the image
 * is treated as a grayscale image.
 * @returns An `ImageData` object with the specified `width` and `height`
 * containing the data contained in the provided Matrices.
 */
export function ImageUtils_convertMatrix2DToImageData(width, height, {
  redChannelMatrix = null,
  greenChannelMatrix = null,
  blueChannelMatrix = null,
  alphaChannelMatrix = null,
  grayChannelMatrix = null
}) {

  const output = new OffscreenCanvas(width, height)
    .getContext('2d')
    .createImageData(width, height);


  for (let i = 0; i < height; i++) {

    for (let j = 0; j < width; j++) {

      if (grayChannelMatrix === null) {

        //If there is no gray channel matrix specified, this is likely
        //an RGB image, so convert the respective pixel decimal values
        //to 255 and set them for the image.
        ImageUtils_setPixelForImageData(output, j, i, [
          redChannelMatrix === null ? 0 : Math.round(redChannelMatrix[i][j] * 255),
          greenChannelMatrix === null ? 0 : Math.round(greenChannelMatrix[i][j] * 255),
          blueChannelMatrix === null ? 0 : Math.round(blueChannelMatrix[i][j] * 255),
          alphaChannelMatrix === null ? 255 : Math.round(alphaChannelMatrix[i][j] * 255),
        ]);
      }
      else {

        //On the other hand, if there is a gray channel, this is likely
        //a grayscale image, so convert that pixel decimal value to 255
        //and set them for the image.
        const pixel_int = Math.round(grayChannelMatrix[i][j] * 255);


        ImageUtils_setPixelForImageData(output, j, i, [
          pixel_int,
          pixel_int,
          pixel_int,
          alphaChannelMatrix === null ? 255 : Math.round(alphaChannelMatrix[i][j] * 255),
        ]);
      }
    }
  }


  return output;
}




export function ImageUtils_getPixelFromImageData(image_data, x, y) {

  //If the x, y coordinates are out of bounds, return null since
  //there is no pixel data there.
  if (
    x < 0 ||
    x >= image_data.width ||
    y < 0 ||
    y >= image_data.height
  ) {
    return null;
  }


  //The index where the pixel data starts. Calculated by determining
  //the offset for where the row starts, then adding the offset of
  //where the column starts.
  const le_index_initial = y * (image_data.width * 4) + (x * 4);



  return image_data.data.slice(
    le_index_initial, //Starting index is inclusive.
    le_index_initial + 4 //Ending index is exclusive.
  );
}




export function ImageUtils_setPixelForImageData(image_data, x, y, pixel) {

  //If the x, y coordinates are out of bounds, do nothing since
  //there is no pixel data there.
  if (
    x < 0 ||
    x >= image_data.width ||
    y < 0 ||
    y >= image_data.height
  ) {
    return;
  }


  //The index where the pixel data starts. Calculated by determining
  //the offset for where the row starts, then adding the offset of
  //where the column starts.
  const le_index_initial = y * (image_data.width * 4) + (x * 4);
  image_data.data[le_index_initial] = pixel[0];
  image_data.data[le_index_initial + 1] = pixel[1];
  image_data.data[le_index_initial + 2] = pixel[2];
  image_data.data[le_index_initial + 3] = pixel[3];
}




/**
 * 
 * @param {uint} image_width 
 * @param {uint} image_height 
 * @param {uint} chunk_size 
 * @returns A list of `ChunkBoundaries` containing the top-left and 
 * bottom-right coordinates of each chunk boundary. It has the following
 * schema :
 * {
 *  x1, y1,
 *  x2, y2,
 * }
 */
export function ImageUtils_generateChunkBoundaries(
  image_width,
  image_height,
  chunk_size,
) {

  const chunk_boundaries = [];


  for (let x = 0; x < image_width; x += chunk_size) {

    //Is the proposed `x_offset` going to be greater than the image's
    //actual width? If so, only offset the image by the amount that is
    //available.
    let x_offset = (x + chunk_size) >= image_width ?
      image_width - x : chunk_size;


    for (let y = 0; y < image_height; y += chunk_size) {

      //Same goes for the `y_offset`.
      let y_offset = (y + chunk_size) >= image_height ?
        image_height - y : chunk_size;


      //Add the chunk boundary to the list of chunk boundaries.
      chunk_boundaries.push({
        x1: x,
        y1: y,
        x2: x + x_offset,
        y2: y + y_offset
      });
    }
  }


  return chunk_boundaries;
}