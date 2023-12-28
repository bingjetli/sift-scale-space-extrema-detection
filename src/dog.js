// @ts-nocheck
import { getImage2DDimensions, setPixelForImageData } from './image2d.js';




export function computeDoGChunk2D(
  image1_2d,
  image2_2d,
  output_image_2d,
  chunk_boundary
) {
  const chunk_image_2d = [];


  for (let y = chunk_boundary.y1; y < chunk_boundary.y2; y++) {
    const image_row = [];


    for (let x = chunk_boundary.x1; x < chunk_boundary.x2; x++) {

      //Take the difference of the gaussian image pixel values and
      //store the result in the output_image_2d.
      const difference = image2_2d[y][x] - image1_2d[y][x];
      output_image_2d[y][x] = difference;


      //Also push the result in the image row
      image_row.push(difference);
    }


    //Push that image row onto the chunk image 2d.
    chunk_image_2d.push(image_row);
  }


  //Return the chunk image_2d array.
  return chunk_image_2d;
}





//Alternate function to convert the difference of gaussian image to 
//an image that can be displayed on the 0-255 RGBA ImageData format.
//This function maps negative values to the red channel, positive values
//to the green channel and neutral values to the blue channel.
export function convertDoGImage2DToImageData(image_2d) {
  const [width, height] = getImage2DDimensions(image_2d);


  const offscreen_canvas_context = new OffscreenCanvas(width, height).getContext('2d');
  const output = offscreen_canvas_context.createImageData(width, height);


  //Calculate the minimum and maximum values of the difference of gaussian
  //image 2d, this will be used to normalize the values later.
  let max = 0;
  let min = 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel_magnitude = Math.abs(image_2d[y][x]);
      max = pixel_magnitude > max ? pixel_magnitude : max;
      min = pixel_magnitude < min ? pixel_magnitude : min;
    }
  }


  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = image_2d[y][x];

      setPixelForImageData(output, x, y, [
        //Red values increase in intensity with negative values.
        pixel < 0 ? (((pixel * -1) - min) / (max - min)) * 255 : 0,

        //Green values increase in intensity with positive values.
        pixel > 0 ? ((pixel - min) / (max - min)) * 255 : 0,

        //Blue values indicate zero crossing points.
        255 - ((Math.abs(pixel) - min) / (max - min) * 255),

        //This will always produce an opaque image.
        255
      ]);
    }
  }


  return output;
}