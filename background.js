import { convertDoGImage2DToImageData } from './src/dog.js';
import { blurChunk2D } from './src/gaussian-blur.js';
import { createBlankImage2D, getImage2DDimensions, image2DLinearDownsample2x, image2DLinearUpsample2x, image2DToImageData } from './src/image2d.js';
import { WorkerMessageTypes } from './src/worker.js';
import { getImageChunkBoundaries } from './unused/image.js';

console.log('background.js is running');




onmessage = e => {
  const message = e.data;


  switch (message.type) {

    case WorkerMessageTypes.COMPUTE_GAUSSIAN_SCALE_SPACE:
      computeGaussianScaleSpace(
        message.inputImage,
        message.numberOfOctaves,
        message.scalesPerOctave,
        message.minBlurLevel,
        message.assumedBlur,
        message.chunkSize,
      );
      break;


    case WorkerMessageTypes.COMPUTE_DIFFERENCE_OF_GAUSSIANS:
      computeDifferenceOfGaussians(message.scaleSpace);
      break;


    default:
      console.log('background.js received the following :');
      console.log(e.data);
  }
};




//This function returns an array which contains the Gaussian Scale Space
//with the following schema :
/**
 * [o, o, ..., o]
 * 
 * where `o` is an Octave of the following schema : 
 * 
 * [s, s, ..., s]
 * 
 * where `s` is a Scale with the following schema :
 * 
 * {
 *  blurLevel : float,
 *  image: Image2D,
 * }
 */
function computeGaussianScaleSpace(
  input_image,
  number_of_octaves,
  scales_per_octave,
  min_blur_level,
  assumed_blur,
  chunk_size,
) {

  const scale_space = [];


  //First, create the base image by resizing the input image by x2.
  let base_image = image2DLinearUpsample2x(input_image);


  //Set the blur level that the base image should have for the first
  //octave.
  let base_blur_level = min_blur_level;


  //Define the constant `k` value that separates each scale inside the
  //octave such that each octave contains :
  /**
   * - The first image of the octave : sigma
   * - The second image of the octave : sigma * k
   * - The third image of the octave : sigma * k^2
   * - The last image of the octave : sigma * k^s
   */
  const k = Math.pow(2, 1 / scales_per_octave);


  for (let octave = 0; octave < number_of_octaves; octave++) {

    const octave_images = [];
    for (let scale = 0; scale < scales_per_octave + 3; scale++) {

      //After the first octave, every first image in the octave references
      //the previous octave's last non-filler scale image.
      if (octave > 0 && scale === 0) {

        //Store a reference to the previous octave's last non-filler
        //scale entry.
        const seed = scale_space[octave - 1][scales_per_octave];


        //Update the base image for this new octave.
        base_image = image2DLinearDownsample2x(seed.image);


        //Update the base blur level for this new octave.
        base_blur_level = seed.blurLevel;


        //Add this image to the octave as it is, it doesn't need to be
        //blurred since it already has the correct blur applied.
        octave_images.push({
          blurLevel: base_blur_level,
          image: base_image,
        });


        //Return the resulting image data back to the main thread to
        //add the image into the stack of Gaussian blurred images.
        postMessage({
          type: WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_IMAGE,
          imageData: image2DToImageData(base_image),
          octave: octave,
        });
      }
      else {

        //Split the base image into chunks.
        const [_width, _height] = getImage2DDimensions(base_image);
        console.log(`Octave : ${octave}, Scale: ${scale}, Dimensions: ${_width}x${_height}`);
        const chunk_boundaries = getImageChunkBoundaries(_width, _height, chunk_size);


        //Create a blank output image of the same dimensions to mutate.
        const output = createBlankImage2D(_height, _width);


        //Calculate the current `k` value for this scale.
        const current_k = Math.pow(k, scale);


        //Then calculate what sigma value we actually need to blur
        //the base image by so that we reach the targeted blur level.
        /**
         * This can be determined using the following semi group relation :
         * 
         * target_sigma^2 = base_sigma^2 + offset_sigma^2
         * target_sigma^2 - base_sigma^2 = offset_sigma^2
         * 
         * sqrt(target_sigma^2 - base_sigma^2) = offset_sigma
         * 
         * `offset_sigma` is how much more we need to blur the image
         * in order to reach the `target_sigma`.
         */
        const target_sigma = base_blur_level * current_k;
        const base_sigma = octave === 0 ?
          assumed_blur * 2 :
          base_blur_level;
        const offset_sigma = Math.sqrt((target_sigma * target_sigma) - (base_sigma * base_sigma));


        //Apply Gaussian blur to each chunk.
        for (let chunk = 0; chunk < chunk_boundaries.length; chunk++) {

          //Blur the current chunk and return the resulting image data back to
          //the main thread to update the canvas.
          postMessage({
            type: WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_CHUNK,
            imageData: image2DToImageData(blurChunk2D(base_image, output, chunk_boundaries[chunk], offset_sigma)),
            dx: chunk_boundaries[chunk].x1,
            dy: chunk_boundaries[chunk].y1,
          });
        }


        //Add the output image and entry to the octave's image stack.
        octave_images.push({
          blurLevel: target_sigma,
          image: output,
        });


        //Return the resulting image data back to the main thread to
        //add the image into the stack of Gaussian blurred images.
        postMessage({
          type: WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_IMAGE,
          imageData: image2DToImageData(output),
          octave: octave,
        });
      }
    }


    //Add the octave images to the scale space.
    scale_space.push(octave_images);
  }


  //Return the resulting scale space back to the main thread.
  postMessage({
    type: WorkerMessageTypes.RECEIVED_GAUSSIAN_SCALE_SPACE,
    scaleSpace: scale_space,
  });
}




//This function returns an array which contains the Difference Of Gaussians
//with the following schema :
/**
 * [o, o, ..., o]
 * 
 * where `o` is an Octave of the following schema : 
 * 
 * [s, s, ..., s]
 * 
 * where `s` is a Scale with the following schema :
 * 
 * {
 *  blurLevel : float,
 *  image: Image2D,
 * }
 */
function computeDifferenceOfGaussians(scale_space) {

  const difference_of_gaussians = [];


  for (let octave = 0; octave < scale_space.length; octave++) {

    const octave_images = [];
    for (let scale = 1; scale < scale_space[octave].length; scale++) {

      const [_width, _height] = getImage2DDimensions(scale_space[octave][scale].image);


      //Cache a handle to the first and second image to calculate the
      //difference of Gaussians on.
      const first_image = scale_space[octave][scale - 1].image;
      const second_image = scale_space[octave][scale].image;


      //Create a blank image2D of the same dimensions as the current
      //scale space image.
      const output = createBlankImage2D(_height, _width);


      for (let y = 0; y < _height; y++) {
        for (let x = 0; x < _width; x++) {

          //Calculate the difference of Gaussian for each pixel.
          output[y][x] = second_image[y][x] - first_image[y][x];
        }
      }


      //Add the resulting difference of Gaussian along with it's respective
      //blur level to the stack of Octave images.
      octave_images.push({
        blurLevel: scale_space[octave][scale - 1].blurLevel,
        image: output,
      });


      //Return this image to the main thread to update the canvas.
      postMessage({
        type: WorkerMessageTypes.RECEIVED_DIFFERENCE_OF_GAUSSIAN_IMAGE,
        imageData: convertDoGImage2DToImageData(output),
        octave: octave,
      });
    }


    //Add the octave images to the difference of Gaussians.
    difference_of_gaussians.push(octave_images);
  }


  //Finally, return the calculated difference of Gaussians back to the
  //main thread.
  postMessage({
    type: WorkerMessageTypes.RECEIVED_DIFFERENCE_OF_GAUSSIANS,
    differenceOfGaussians: difference_of_gaussians,
  });
}