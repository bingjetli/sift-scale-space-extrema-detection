// @ts-nocheck
import { getPixelFromImageData, setPixelForImageData } from './image.js';

export function subtractImageData(image_data_1, image_data_2) {
  const output = [];

  for (let y = 0; y < image_data_1.height; y++) {
    const output_row = [];
    for (let x = 0; x < image_data_1.width; x++) {
      const image_1_pixel = getPixelFromImageData(image_data_1, x, y);
      const image_2_pixel = getPixelFromImageData(image_data_2, x, y);

      output_row.push(subtractPixels(image_1_pixel, image_2_pixel));
    }


    output.push(output_row);
  }


  return output;
}




function subtractPixels(pixel_1, pixel_2) {
  return [
    pixel_2[0] - pixel_1[0],
    pixel_2[1] - pixel_1[1],
    pixel_2[2] - pixel_1[2],
    pixel_2[3] - pixel_1[3]
  ];
}




export function dogToImageData(dog_result) {
  const _height = dog_result.length;
  const _width = dog_result[0].length;


  const offscreen_canvas_context = new OffscreenCanvas(_width, _height).getContext('2d');
  const output = offscreen_canvas_context.createImageData(_width, _height);


  //Retreive the min and max values within the DoG result, this will
  //be used to normalize the data and convert it into an Image Data.
  let min = [
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER,
  ];
  let max = [
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
  ];
  for (let y = 0; y < _height; y++) {
    for (let x = 0; x < _width; x++) {
      min[0] = dog_result[y][x][0] < min[0] ? dog_result[y][x][0] : min[0];
      min[1] = dog_result[y][x][1] < min[1] ? dog_result[y][x][1] : min[1];
      min[2] = dog_result[y][x][2] < min[2] ? dog_result[y][x][2] : min[2];


      max[0] = dog_result[y][x][0] > max[0] ? dog_result[y][x][0] : max[0];
      max[1] = dog_result[y][x][1] > max[1] ? dog_result[y][x][1] : max[1];
      max[2] = dog_result[y][x][2] > max[2] ? dog_result[y][x][2] : max[2];
    }
  }


  //Normalize the DoG result and set the image pixel data.
  for (let y = 0; y < _height; y++) {
    for (let x = 0; x < _width; x++) {
      setPixelForImageData(output, x, y, [
        Math.round(((dog_result[y][x][0] - min[0]) / (max[0] - min[0])) * 255),
        Math.round(((dog_result[y][x][1] - min[1]) / (max[1] - min[1])) * 255),
        Math.round(((dog_result[y][x][2] - min[2]) / (max[2] - min[2])) * 255),
        255
      ]);
    }
  }


  return output;
}