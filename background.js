//@ts-nocheck
'use strict';

import { ImageUtils_convertMatrix2DToImageData, ImageUtils_generateChunkBoundaries } from './src/image-utils.js';
import { Matrix2D_build, Matrix2D_get2x2Determinant, Matrix2D_get3x3Inverse, Matrix2D_getDimensions, Matrix2D_getMinorMatrix, Matrix2D_getTrace, Matrix2D_linearResize, Matrix2D_sampledNormalize, Matrix2D_scalarMultiply, Matrix2D_sigmoidNormalize, Matrix2D_vectorMultiply } from './src/matrix2d.js';
import { SIFT_blurMatrix2DChunk, SIFT_findExtremas, SIFT_generateGradientVector, SIFT_generateHessianMatrix, SIFT_subtractMatrix2DChunk } from './src/sift.js';
import { WorkerMessageTypes } from './src/worker.js';

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


    case WorkerMessageTypes.FIND_CANDIDATE_KEYPOINTS:
      findCandidateKeypoints(e.data);
      break;


    case WorkerMessageTypes.REFINE_CANDIDATE_KEYPOINTS:
      refineCandidateKeypoints(e.data);
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
  let base_image = Matrix2D_linearResize(input_image, 0.5);


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


        //Downsample the base image for this new octave.
        base_image = Matrix2D_linearResize(seed.image, 2.0);


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
        const [_height, _width] = Matrix2D_getDimensions(base_image);
        postMessage({
          type: WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_IMAGE,
          //imageData: image2DToImageData(base_image),
          imageData: ImageUtils_convertMatrix2DToImageData(_width, _height, {
            grayChannelMatrix: base_image
          }),
          octave: octave,
        });
      }
      else {

        //Split the base image into chunks.
        const [_height, _width] = Matrix2D_getDimensions(base_image);
        const chunk_boundaries = ImageUtils_generateChunkBoundaries(_width, _height, chunk_size);


        //Create a blank output image of the same dimensions to mutate.
        const output = Matrix2D_build(_height, _width, (i, j) => 0);


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
          assumed_blur :
          base_blur_level;
        const offset_sigma = Math.sqrt((target_sigma * target_sigma) - (base_sigma * base_sigma));


        //Apply Gaussian blur to each chunk.
        for (let chunk = 0; chunk < chunk_boundaries.length; chunk++) {

          //Blur the current chunk and return the resulting image data back to
          //the main thread to update the canvas.
          const blurred_chunk = SIFT_blurMatrix2DChunk(
            base_image,
            output,
            offset_sigma,
            chunk_boundaries[chunk],
          );


          const [_chunk_h, _chunk_w] = Matrix2D_getDimensions(blurred_chunk);
          postMessage({
            type: WorkerMessageTypes.RECEIVED_GAUSSIAN_BLURRED_CHUNK,
            //imageData: image2DToImageData(blurChunk2D(base_image, output, chunk_boundaries[chunk], offset_sigma)),
            imageData: ImageUtils_convertMatrix2DToImageData(_chunk_w, _chunk_h, {
              grayChannelMatrix: blurred_chunk,
            }),
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
          //imageData: image2DToImageData(output),
          imageData: ImageUtils_convertMatrix2DToImageData(_width, _height, {
            grayChannelMatrix: output
          }),
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
function computeDifferenceOfGaussians(scale_space, chunk_size = 32) {

  const difference_of_gaussians = [];


  //Cache the number of octaves as well as the scales per octave to
  //avoid repeatedly dereferencing the array.
  const number_of_octaves = scale_space.length;
  const scales_per_octave = scale_space[0].length;


  for (let octave = 0; octave < number_of_octaves; octave++) {

    const octave_images = [];
    for (let scale = 1; scale < scales_per_octave; scale++) {


      //Retreive a handle to the base image and the adjacent image.
      const base_image = scale_space[octave][scale - 1].image;
      const adjacent_image = scale_space[octave][scale].image;


      //Retreive the image dimensions of the base image.
      const [_height, _width] = Matrix2D_getDimensions(base_image);


      //Split the base image into chunks.
      const chunk_boundaries = ImageUtils_generateChunkBoundaries(_width, _height, chunk_size);


      //Create a blank image2D of the same dimensions as the current
      //scale space image.
      const output = Matrix2D_build(_height, _width, (i, j) => 0);


      const total_chunks = chunk_boundaries.length;
      for (let chunk = 0; chunk < total_chunks; chunk++) {

        //Cache a handle to the current chunk to prevent frequent
        //array dereferencing.
        const current_chunk = chunk_boundaries[chunk];


        //Return a normalized DoG chunk back to the main thread to 
        //update the main canvas.
        const dog_chunk = Matrix2D_sigmoidNormalize(SIFT_subtractMatrix2DChunk(
          [base_image, adjacent_image],
          output,
          current_chunk,
        ), 5);


        const [chunk_h, chunk_w] = Matrix2D_getDimensions(dog_chunk);


        postMessage({
          type: WorkerMessageTypes.RECEIVED_DIFFERENCE_OF_GAUSSIAN_CHUNK,
          imageData: ImageUtils_convertMatrix2DToImageData(chunk_w, chunk_h, {
            grayChannelMatrix: dog_chunk,
          }),
          dx: current_chunk.x1,
          dy: current_chunk.y1,
        });
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
        imageData: ImageUtils_convertMatrix2DToImageData(_width, _height, {
          grayChannelMatrix: Matrix2D_sampledNormalize(output),
        }),
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




function findCandidateKeypoints({
  differenceOfGaussians,
  octaveBaseImages,
  scalesPerOctave,
}) {

  const extremas = [];


  //Cache the number of octaves as well as the scales per octave to
  //avoid repeatedly dereferencing the array.
  const number_of_octaves = differenceOfGaussians.length;
  const number_of_scales = differenceOfGaussians[0].length;


  for (let octave = 0; octave < number_of_octaves; octave++) {

    const octave_scales = [];
    for (let scale = 1; scale < number_of_scales - 1; scale++) {

      //Retreive the image data of the octave's base image to mark the 
      //candidate keypoints found.
      //const base_image = image2DToImageData(octaveBaseImages[octave]);
      const [_height, _width] = Matrix2D_getDimensions(differenceOfGaussians[octave][scale].image);
      const base_image = ImageUtils_convertMatrix2DToImageData(
        _width,
        _height,
        {
          grayChannelMatrix: Matrix2D_sampledNormalize(differenceOfGaussians[octave][scale].image),
        },
      );


      postMessage({
        type: WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_BASE_IMAGE,
        imageData: base_image,
      });

      //Find the local extremas within the difference of Gaussians.
      const {
        candidateKeypoints: local_extremas,
        lowContrastKeypoints: low_contrast_extremas,
      } = SIFT_findExtremas([
        differenceOfGaussians[octave][scale - 1].image,
        differenceOfGaussians[octave][scale].image,
        differenceOfGaussians[octave][scale + 1].image,
      ], scalesPerOctave);


      low_contrast_extremas.forEach(extrema => postMessage({
        type: WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_MARKER,
        x: extrema.x,
        y: extrema.y,
        isLowContrast: true,
      }));


      local_extremas.forEach(extrema => postMessage({
        type: WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_MARKER,
        x: extrema.x,
        y: extrema.y,
        isLowContrast: false,
      }));


      //Return the ImageData containing the candidate keypoints back to
      //the main thread to be displayed on the canvas.
      postMessage({
        type: WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINT_IMAGE,
        octave: octave,
      });


      //Add the list of candidate keypoints to the octaves array.
      octave_scales.push({
        scaleLevel: scale,
        localExtremas: local_extremas,
      });
    }


    //Add the octave array to the array of candidate keypoint extremas.
    extremas.push(octave_scales);
  }


  //Return the list of candidate keypoints found back to the main thread.
  postMessage({
    type: WorkerMessageTypes.RECEIVED_CANDIDATE_KEYPOINTS,
    candidateKeypoints: extremas,
  });
}




function refineCandidateKeypoints({
  differenceOfGaussians,
  scalesPerOctave,
  numberOfOctaves,
  candidateKeypoints,
  minBlurLevel,
  minInterpixelDistance = 0.5,
}) {

  //Create and initialize the list of refined candidate keypoints.
  const refined_keypoints = [];


  for (let octave = 0; octave < numberOfOctaves; octave++) {
    for (let scale_i = 0; scale_i < scalesPerOctave; scale_i++) {

      candidateKeypoints[octave][scale_i].localExtremas.forEach(extrema => {

        //For each discrete extrema, we need the scale level `s`, and
        //the discrete positions `m` and `n` corresponding to the discrete
        //`x` and `y` values.
        let is_discarded = true;
        let s = candidateKeypoints[octave][scale_i].scaleLevel;
        let m = extrema.y; //Row
        let n = extrema.x; //Column
        for (let i = 0; i < 5; i++) {

          //For each discrete extrema, we will try to perform the 
          //quadratic fit at least 5 times or until the calculated
          //result is < 0.6.

          //Try to perform the quadratic interpolation.
          let interpolation_offset = null;
          let interpolated_value = null;


          //Compute the 3D Gradient using the finite differences method.
          /**
           * The Gradient Vector has the following schema :
           * 
           * +- -+
           * | s |
           * | m |
           * | n |
           * +- -+
           * 
           * where `s` refers to the scale space, `m` refers to the row
           * of the image and `n` refers to the column of the image.
           * 
           */
          const gradient_vector = SIFT_generateGradientVector(
            octave, s, m, n,
            differenceOfGaussians
          );



          //Compute the Hessian Matrix using the finite differences method.
          /**
           * The Hessian Matrix has the following schema :
           * 
           * +-           -+
           * | h11 h12 h13 |
           * | h12 h22 h23 |
           * | h13 h23 h33 |
           * +-           -+
           * 
           */
          const hessian_matrix = SIFT_generateHessianMatrix(
            octave, s, m, n,
            differenceOfGaussians
          );


          /** CALCULATING THE INTERPOLATION VALUE AND INTERPOLATION OFFSET
           * 
           * The interpolation value `omega` with respect to the interpolation
           * offset `alpha` is given by the following function :
           * 
           *   omega(alpha) = extrema + (transpose(alpha) * gradient) + (0.5 * transpose(alpha) * hessian * alpha)
           * 
           * The interpolation offset is calculated by solving the partial
           * derivative equation of `nabla omega(alpha) = 0` where `nabla`
           * refers to the gradient operator (not the 3D gradient vector).
           * 
           * 
           * Solving this gives us the equation for the interpolation offset :
           * 
           * alpha = -(1 / hessian) * gradient
           * 
           */
          const hessian_inverse = Matrix2D_get3x3Inverse(hessian_matrix);


          //Now the interpolation offset is calculated by multiplying
          //the Gradient vector by the Negative Inverse of the Hessian.
          interpolation_offset = Matrix2D_vectorMultiply(
            Matrix2D_scalarMultiply(hessian_inverse, -1),
            gradient_vector
          );


          //Now that we have the interpolation offset, test for validity.
          if (interpolation_offset.every(element => Math.abs(element) < 0.6)) {

            //This is a valid keypoint, break at the end of this block.
            //Since this is a valid keypoint, calculate the interpolation
            //value so we can determine whether or not to discard this
            //keypoint due to low contrast. The interpolation value
            //is given by `extrema + 0.5 * transpose(interpolation_offset) * gradient`
            interpolated_value = extrema.value + (((0.5 * interpolation_offset[0]) * gradient_vector[0]) + ((0.5 * interpolation_offset[1]) * gradient_vector[1]) + ((0.5 * interpolation_offset[2]) * gradient_vector[2]));


            //Filter out low contrast keypoints before adding it to the list
            //of candidate keypoints. There is a magic number threshold with 
            //the value `0.015` for `3` scales per octave. There is a way to
            //scale this value relative to the specified scales per octave.
            const threshold = ((Math.pow(2, 1 / scalesPerOctave) - 1) / (Math.pow(2, 1 / 3) - 1)) * 0.015;


            //Filter the interpolated keypoint again to remove low contrast
            //keypoints.
            if (Math.abs(interpolated_value) < threshold) {

              //Otherwise, if it fails, then it is discarded due to 
              //being a low contrast keypoint.
              console.log(`interpolated keypoint at Octave ${octave}, Scale ${s}, ( ${n}, ${m}) failed to pass the contrast threshold test with a value of ${interpolated_value}.`);
              break;
            }


            //Filter the interpolated keypoint to remove edge responses.
            //To remove edge responses, we need to calculate the eigenvalue
            //ratio of the Hessian Matrix.
            const bottom_right_hessian_matrix = Matrix2D_getMinorMatrix(
              hessian_matrix, 0, 0
            );
            const bottom_right_hessian_trace = Matrix2D_getTrace(bottom_right_hessian_matrix);
            const bottom_right_hessian_determinant = Matrix2D_get2x2Determinant(bottom_right_hessian_matrix);
            const edgeness = (bottom_right_hessian_trace * bottom_right_hessian_trace) / bottom_right_hessian_determinant;
            //There is another magic number threshold, where `c_edge` is
            //set to 10, and the threshold comparison value is given by
            //`(c_edge + 1)^2 / c_edge`
            const edge_threshold = ((10 + 1) * (10 + 1)) / 10;
            if (edgeness > edge_threshold) {

              //If it fails the edge threshold test, then it is discarded.
              console.log(`interpolated keypoint at Octave ${octave}, Scale ${s}, ( ${n}, ${m}) failed to pass the edge threshold test with a value of ${edgeness}.`);
              break;
            }


            //If the interpolated value passes all tests, then we
            //can calculate the keypoint's absolute coordinates and add 
            //it to the list of interpolated keypoints.
            is_discarded = false;
            const octave_interpixel_distance = Math.pow(2, octave - 1);
            const absolute_y = octave_interpixel_distance * (interpolation_offset[1] + m);
            const absolute_x = octave_interpixel_distance * (interpolation_offset[2] + n);
            const absolute_sigma = (octave_interpixel_distance / minInterpixelDistance) * minBlurLevel * Math.pow(2, (interpolation_offset[0] + s) / scalesPerOctave);
            console.log(`Keypoint found at (${absolute_x}, ${absolute_y}) with absolute sigma : ${absolute_sigma}`);


            //Add this interpolated keypoint to the list of refined keypoints.
            refined_keypoints.push({
              octave: octave,
              scaleLevel: s,
              localX: n,
              localY: m,
              absoluteSigma: absolute_sigma,
              absoluteX: absolute_x,
              absoluteY: absolute_y,
              interpolatedValue: interpolated_value,
            });

            break;
          }


          //If we haven't broken out of the loop yet, that means we
          //haven't found a valid interpolation offset yet. So we move
          //the discrete s, m and n values to the next closest discrete
          //value to (s, m, n) + interpolation_offset.
          s = Math.round(s + interpolation_offset[0]);
          m = Math.round(m + interpolation_offset[1]);
          n = Math.round(n + interpolation_offset[2]);


          //Validate the updated (s, m, n) values.
          if (s < 1 || s >= differenceOfGaussians[octave].length - 1) {

            //This means the extremum failed to converge before it
            //reached outside the scale space.
            console.log(`candidate keypoint at Octave ${octave}, Scale ${scale_i}, ( ${extrema.x}, ${extrema.y}) failed to converge before exiting scale space.`);
            break;
          }
          if (m < 1 || m >= differenceOfGaussians[octave][s].image.length - 1) {

            //This means the extremum failed to converge before it
            //reached outside the valid image rows.
            console.log(`candidate keypoint at Octave ${octave}, Scale ${scale_i}, ( ${extrema.x}, ${extrema.y}) failed to converge before exiting the image y-dimension.`);
            break;
          }
          if (n < 1 || n >= differenceOfGaussians[octave][s].image[m].length - 1) {

            //This means the extremum failed to converge before it
            //reached outside the valid image columns.
            console.log(`candidate keypoint at Octave ${octave}, Scale ${scale_i}, ( ${extrema.x}, ${extrema.y}) failed to converge before exiting the image x-dimension.`);
            break;
          }


          //If the s, m, n values are valid, the loop proceeds normally.
        }


        if (is_discarded === true) {
          console.log(`candidate keypoint at Octave ${octave}, Scale_i ${scale_i}, ( ${extrema.x}, ${extrema.y}) is discarded...`);
        }
      });

    }
  }


  //Send the refined keypoints back to the main thread.
  postMessage({
    type: WorkerMessageTypes.RECEIVED_REFINED_KEYPOINTS,
    refinedKeypoints: refined_keypoints,
  });
}