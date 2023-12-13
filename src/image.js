//Returns a copy the pixel located at `x`, `y` of the specified `image_data`. 
//This pixel is 4 indices containing values of 0-255 with each index 
//corresponding to the RGBA value of the pixel. The pixel that is returned
//cannot interact with the pixel data in the image data. This function
//returns `null` if the `x` and `y` coordinates are out of bounds.
export function getPixelFromImageData(image_data, x, y) {
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
export function setPixelForImageData(image_data, x, y, pixel) {
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




//Calculates a list of chunk boundaries to be used with `getImageData()`
//and returns a list of objects containing the specified schema :
//{
// x1 : int,
// y1 : int,
// x2 : int,
// y2 : int
//}
export function getImageChunkBoundaries(
  image_width,
  image_height,
  chunk_size,
) {
  /**
   */
  const chunk_boundaries = [];

  for (let x = 0; x < image_width; x += chunk_size) {
    //Is the proposed `x_offset` going to be greater than the image's
    //actual width? If so, only offset the image by the amount that is
    //available.
    let x_offset = (x + chunk_size) >= image_width ?
      image_width - x - 1 : chunk_size;

    for (let y = 0; y < image_height; y += chunk_size) {
      //Same goes for the `y_offset`.
      let y_offset = (y + chunk_size) >= image_height ?
        image_height - y - 1 : chunk_size;

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



export function getKernelExpandedImageChunkBoundary(
  kernel_size,
  image_chunk,
  image_height,
  image_width
) {
  const kernel_expansion_factor = Math.floor(kernel_size / 2);
  const expanded_image_chunk = { ...image_chunk };


  expanded_image_chunk.x1 = image_chunk.x1 - kernel_expansion_factor < 0 ?
    0 : image_chunk.x1 - kernel_expansion_factor;

  expanded_image_chunk.x2 = image_chunk.x2 + kernel_expansion_factor >= image_width ?
    image_width - 1 : image_chunk.x2 + kernel_expansion_factor;

  expanded_image_chunk.y1 = image_chunk.y1 - kernel_expansion_factor < 0 ?
    0 : image_chunk.y1 - kernel_expansion_factor;

  expanded_image_chunk.y2 = image_chunk.y2 + kernel_expansion_factor >= image_height ?
    image_height - 1 : image_chunk.y2 + kernel_expansion_factor;


  return expanded_image_chunk;
}




//Given a larger expanded chunk boundary, and a smaller initial boundary,
//it calculates the difference between them and returns how much you need
//to offset each boundary edge to get the set of pixels that would have
//been contained in the original boundary.
export function calculateExpandedChunkOffset(
  initial_chunk_boundary,
  expanded_chunk_boundary
) {
  const offset = { ...expanded_chunk_boundary };


  offset.x1 -= initial_chunk_boundary.x1;
  offset.x2 -= initial_chunk_boundary.x2;
  offset.y1 -= initial_chunk_boundary.y1;
  offset.y2 -= initial_chunk_boundary.y2;

  offset.x1 *= -1;
  offset.x2 *= -1;
  offset.y1 *= -1;
  offset.y2 *= -1;


  return offset;
}


export function toImageDataCorners(chunk_boundary) {
  return {
    left: chunk_boundary.x1,
    top: chunk_boundary.y1,
    width: chunk_boundary.x2 - chunk_boundary.x1,
    height: chunk_boundary.y2 - chunk_boundary.y1
  };
}