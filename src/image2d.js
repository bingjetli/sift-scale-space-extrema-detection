//@ts-nocheck
/**
 * Converts the ImageData object into a 2D array of pixels with the
 * following schema :
 * [
 *  [p, p, ..., p],
 *  [p, p, ..., p],
 *    ...
 *  [p, p, ..., p]
 * ]
 * 
 * 
 * where `p` represents a pixel.
 * 
 * 
 * The first dimension is the y axis, followed by the x axis; So `Image2D[y]`
 * accesses the row of pixels in that column and `Image2D[y][x] accesses the
 * pixel at that column & row.
 * 
 * 
 * This structure is less about being efficient or performant, and more
 * about creating a structure that's intuitive to the way I understand
 * images and pixel data.
 * 
 * 
 * Image height information can be obtained from : `Image2D.length`. And
 * Image width information can be obtained from : `Image2D[0].length`.
 */
export function imageDataToImage2D(image_data, colorspace = Image2DColorSpace.PERCEPTION_GRAYSCALE) {
  const image_2d = [];


  for (let y = 0; y < image_data.height; y++) {
    const image_row = [];


    for (let x = 0; x < image_data.width; x++) {
      const pixel = getPixelFromImageData(image_data, x, y);


      switch (colorspace) {
        case Image2DColorSpace.PERCEPTION_GRAYSCALE:
          //Convert image to grayscale using perception based weights
          //and no alpha channel.
          image_row.push(
            (pixel[0] * 0.299) + (pixel[1] * 0.587) + (pixel[2] * 0.114)
          );
          break;

        default:
          //Unrecognized colorspace value, skip.
          continue;
      }
    }


    //Only push the row onto the image_column if there is content.
    if (image_row.length > 0) image_2d.push(image_row);
  }


  return image_2d;
}


export const Image2DColorSpace = {
  PERCEPTION_GRAYSCALE: 'perception-grayscale',
};


//Returns a copy the pixel located at `x`, `y` of the specified `image_data`. 
//This pixel is 4 indices containing values of 0-255 with each index 
//corresponding to the RGBA value of the pixel. The pixel that is returned
//cannot interact with the pixel data in the image data. This function
//returns `null` if the `x` and `y` coordinates are out of bounds.
function getPixelFromImageData(image_data, x, y) {
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




//This function mutates the pixel rgba array at `x` and `y` for the
//specified `image_data`. The `pixel` parameter takes an array of length
//4 with each index corresponding to the pixel's RGBA value from 0-255.
//This function does nothing if the `x` and `y` values are out of bounds.
function setPixelForImageData(image_data, x, y, pixel) {
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




export function image2DToImageData(image_2d, colorspace = Image2DColorSpace.PERCEPTION_GRAYSCALE) {
  const image_height = image_2d.length;
  const image_width = image_2d[0].length;
  const offscreen_canvas_context = new OffscreenCanvas(image_width, image_height).getContext('2d');
  const output = offscreen_canvas_context.createImageData(image_width, image_height);


  for (let y = 0; y < image_height; y++) {
    for (let x = 0; x < image_width; x++) {
      setPixelForImageData(output, x, y, [
        Math.round(image_2d[y][x]),
        Math.round(image_2d[y][x]),
        Math.round(image_2d[y][x]),
        255
      ]);
    }
  }


  return output;
}



//Returns the width and height of the Image2D array as an array containing
//the respective dimensions. This can be destructured into [width, height]
//on assignment.
export function getImage2DDimensions(image_2d) {
  return [image_2d[0].length, image_2d.length];
}




//NO COLORSPACE OR ALPHA SUPPORT
export function createBlankImage2D(height, width) {
  const copy_image_2d = [];


  for (let y = 0; y < height; y++) {
    const image_row = [];


    for (let x = 0; x < width; x++) {
      image_row.push(0);
    }


    copy_image_2d.push(image_row);
  }


  return copy_image_2d;
}




//NO COLORSPACE OR ALPHA SUPPORT
export function image2DLinearUpsample2x(image_2d) {
  const [width, height] = getImage2DDimensions(image_2d);
  const copy_image_2d = [];


  for (let y = 0; y < height; y++) {
    const image_row = [];


    for (let x = 0; x < width; x++) {

      //Deep copy the pixel value by converting it into a string. Then
      //parsing it into a number again.
      const pixel_value = Number(`${image_2d[y][x]}`);


      //The pixel value is pushed twice because in the new array, it
      //takes up 2 pixels in the grid instead of 1 due to nearest
      //neighbor interpolation.
      image_row.push(pixel_value);
      image_row.push(pixel_value);
    }


    //Likewise, the row is pushed twice for the same reason. This results
    //in an image that's twice the size of the original and each pixel
    //takes up 2 pixels space instead of 1.
    copy_image_2d.push(image_row);
    copy_image_2d.push(image_row);
  }


  return copy_image_2d;
}




export function image2DLinearDownsample2x(image_2d) {
  const [width, height] = getImage2DDimensions(image_2d);
  const copy_image_2d = [];


  for (let y = 0; y < height; y += 2) {
    const image_row = [];


    for (let x = 0; x < width; x += 2) {

      //Deep copy the pixel value by converting it into a string. Then
      //parsing it into a number again.
      const pixel_value = Number(`${image_2d[y][x]}`);


      //Add the sampled pixel onto the image row.
      image_row.push(pixel_value);
    }


    //Add this row to the stack of rows which form the image.
    copy_image_2d.push(image_row);
  }


  return copy_image_2d;
}