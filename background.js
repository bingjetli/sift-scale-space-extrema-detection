//@ts-nocheck
'use strict';

import { ImageUtils_convertMatrix2DToImageData, ImageUtils_generateChunkBoundaries } from './src/image-utils.js';
import { Matrix2D_build, Matrix2D_getDimensions, Matrix2D_linearResize, Matrix2D_sampledNormalize, Matrix2D_sigmoidNormalize } from './src/matrix2d.js';
import { SIFT_blurMatrix2DChunk, SIFT_findExtremas, SIFT_subtractMatrix2DChunk } from './src/sift.js';
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
}) {

  for (let octave = 0; octave < numberOfOctaves; octave++) {
    for (let scale_i = 0; scale_i < scalesPerOctave; scale_i++) {

      const scale = candidateKeypoints[octave][scale_i].scaleLevel;
      candidateKeypoints[octave][scale_i].localExtremas.forEach(extrema => {

        //For each discrete extrema, we need the scale level `s`, and
        //the discrete positions `m` and `n` corresponding to the discrete
        //`x` and `y` values.
        for (let i = 0; i < 5; i++) {

          //For each discrete extrema, we will try to perform the 
          //quadratic fit at least 5 times or until the calculated
          //result is < 0.6.

          //Try to perform the quadratic interpolation.
          let interpolation_offset = null;
          let interpolation_result = null;


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
           */
          const gradient = {
            s: (
              differenceOfGaussians[octave][scale + 1].image[extrema.y][extrema.x] -
              differenceOfGaussians[octave][scale - 1].image[extrema.y][extrema.x]
            ) / 2,
            m: (
              differenceOfGaussians[octave][scale].image[extrema.y][extrema.x + 1] -
              differenceOfGaussians[octave][scale].image[extrema.y][extrema.x - 1]
            ) / 2,
            n: (
              differenceOfGaussians[octave][scale].image[extrema.y + 1][extrema.x] -
              differenceOfGaussians[octave][scale].image[extrema.y - 1][extrema.x]
            ) / 2,
          };


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
          const hessian = {
            h11: (
              differenceOfGaussians[octave][scale + 1].image[extrema.y][extrema.x] +
              differenceOfGaussians[octave][scale - 1].image[extrema.y][extrema.x] -
              (2 * differenceOfGaussians[octave][scale].image[extrema.y][extrema.x])
            ),
            h22: (
              differenceOfGaussians[octave][scale].image[extrema.y][extrema.x + 1] +
              differenceOfGaussians[octave][scale].image[extrema.y][extrema.x - 1] -
              (2 * differenceOfGaussians[octave][scale].image[extrema.y][extrema.x])
            ),
            h33: (
              differenceOfGaussians[octave][scale].image[extrema.y + 1][extrema.x] +
              differenceOfGaussians[octave][scale].image[extrema.y - 1][extrema.x] -
              (2 * differenceOfGaussians[octave][scale].image[extrema.y][extrema.x])
            ),
            h12: (
              differenceOfGaussians[octave][scale + 1].image[extrema.y][extrema.x + 1] -
              differenceOfGaussians[octave][scale + 1].image[extrema.y][extrema.x - 1] -
              differenceOfGaussians[octave][scale - 1].image[extrema.y][extrema.x + 1] +
              differenceOfGaussians[octave][scale - 1].image[extrema.y][extrema.x - 1]
            ) / 4,
            h13: (
              differenceOfGaussians[octave][scale + 1].image[extrema.y + 1][extrema.x] -
              differenceOfGaussians[octave][scale + 1].image[extrema.y - 1][extrema.x] -
              differenceOfGaussians[octave][scale - 1].image[extrema.y + 1][extrema.x] +
              differenceOfGaussians[octave][scale - 1].image[extrema.y - 1][extrema.x]
            ) / 4,
            h23: (
              differenceOfGaussians[octave][scale].image[extrema.y + 1][extrema.x + 1] -
              differenceOfGaussians[octave][scale].image[extrema.y - 1][extrema.x + 1] -
              differenceOfGaussians[octave][scale].image[extrema.y + 1][extrema.x - 1] +
              differenceOfGaussians[octave][scale].image[extrema.y - 1][extrema.x - 1]
            ) / 4,
          };


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

          //Since calculating the interpolation offset involves calculating
          //the inverse of the Hessian Matrix, so we start by calculating
          //the determinant of the Hessian Matrix since we can only find
          //an inverse of a Matrix if the determinant is not 0.

          /** CALCULATING THE DETERMINANT OF A 3x3 MATRIX
           * 
           * Given a 3x3 matrix with the scheme :
           * 
           * +-     -+
           * | a b c |
           * | d e f |
           * | g h i |
           * +-     -+
           * 
           * The determinant of this matrix is given by :
           *  a * minor(a) - b * minor(b) + c * minor(c)
           * 
           * where the `minor(§)` is given by the determinant of the resulting
           * matrix when the column and row containing `§` is removed.
           * 
           * 
           * The final formula is given by : a(ei - fh) - b(di - fg) + c(dh - eg)
           * 
           * 
           ** CALCULATING THE DETERMINANT OF A 2x2 MATRIX
           * 
           * Given a 2x2 matrix with the scheme :
           * 
           * +-   -+
           * | a b |
           * | c d |
           * +-   -+
           * 
           * The determinant of this matrix is given by :
           * ad - bc
           * 
           * 
           */

          //Compute and cache the first 3 minors to use in order to 
          //calculate the determinant of the hessian matrix.
          const minor_h11 = ((hessian.h22 * hessian.h33) - (hessian.h23 * hessian.h23));
          const minor_h12 = ((hessian.h12 * hessian.h33) - (hessian.h23 * hessian.h13));
          const minor_h13 = ((hessian.h12 * hessian.h23) - (hessian.h22 * hessian.h13));


          //Calculate the determinant using the minors calculated earlier.
          const hessian_determinant = (hessian.h11 * minor_h11) -
            (hessian.h12 * minor_h12) +
            (hessian.h13 * minor_h13);


          //EPSILON is the smallest increment between 1.0 and the next
          //number following 1.0. Therefore determinant values smaller
          //than this EPSILON value is treated as effectively zero since
          //floating point math becomes inaccurate after a certain level
          //of precision. Since the determinant is effectively zero,
          //we treat it as such, and an inverse cannot be calculated
          //for matrices with a determinant of 0.
          if (hessian_determinant < Number.EPSILON) break;


          //If the determinant is valid, then we calculate the minor
          //matrix for the Hessian in order to calculate the cofactors.
          const minor = {
            h11: minor_h11,
            h12: minor_h12,
            h13: minor_h13,
            h21: ((hessian.h12 * hessian.h33) - (hessian.h13 * hessian.h23)),
            h22: ((hessian.h11 * hessian.h33) - (hessian.h13 * hessian.h13)),
            h23: ((hessian.h11 * hessian.h23) - (hessian.h12 * hessian.h13)),
            h31: ((hessian.h12 * hessian.h23) - (hessian.h13 * hessian.h22)),
            h32: ((hessian.h11 * hessian.h23) - (hessian.h13 * hessian.h12)),
            h33: ((hessian.h11 * hessian.h22) - (hessian.h12 * hessian.h12)),
          };


          //Now calculate the cofactor matrix for the Hessian.
          const cofactors = {
            h11: minor.h11,
            h12: minor.h12 * -1,
            h13: minor.h13,
            h21: minor.h21 * -1,
            h22: minor.h22,
            h23: minor.h23 * -1,
            h31: minor.h31,
            h32: minor.h32 * -1,
            h33: minor.h33,
          };


          //Transposing the cofactor matrix will now give the adjunct
          //matrix which can be scalar divided by the determinant to
          //produce the inverse of the Hessian matrix.
          /** TRANSPOSING MATRICES
           * 
           * Transposing a matrix means to switch its columns with its
           * rows. So given a 3x3 matrix of the following schema :
           * 
           * +-        -+
           * | 11 12 13 |
           * | 21 22 23 |
           * | 31 32 33 |
           * +-        -+
           * 
           * The transpose of this matrix will be :
           * 
           * +-        -+
           * | 11 21 31 |
           * | 12 22 32 |
           * | 13 23 33 |
           * +-        -+
           * 
           */
          const adjunct = {
            h11: cofactors.h11,
            h12: cofactors.h21,
            h13: cofactors.h31,
            h21: cofactors.h12,
            h22: cofactors.h22,
            h23: cofactors.h32,
            h31: cofactors.h13,
            h32: cofactors.h23,
            h33: cofactors.h33,
          };


          const hessian_inverse = {
            h11: adjunct.h11 / hessian_determinant,
            h12: adjunct.h12 / hessian_determinant,
            h13: adjunct.h13 / hessian_determinant,
            h21: adjunct.h21 / hessian_determinant,
            h22: adjunct.h22 / hessian_determinant,
            h23: adjunct.h23 / hessian_determinant,
            h31: adjunct.h31 / hessian_determinant,
            h32: adjunct.h32 / hessian_determinant,
            h33: adjunct.h33 / hessian_determinant,
          };


          //Debugging the matrix calculations
          //
          //console.log('----');
          //console.log('Determinant : ' + hessian_determinant);
          //console.log(
          //  'Hessian : \n' +
          //  hessian.h11 + ' ' + hessian.h12 + ' ' + hessian.h13 + '\n' +
          //  hessian.h12 + ' ' + hessian.h22 + ' ' + hessian.h23 + '\n' +
          //  hessian.h13 + ' ' + hessian.h23 + ' ' + hessian.h33 + '\n'
          //);
          //console.log(
          //  'Hessian Minors : \n' +
          //  minor.h11 + ' ' + minor.h12 + ' ' + minor.h13 + '\n' +
          //  minor.h21 + ' ' + minor.h22 + ' ' + minor.h23 + '\n' +
          //  minor.h31 + ' ' + minor.h32 + ' ' + minor.h33 + '\n'
          //);
          //console.log(
          //  'Hessian Cofactors : \n' +
          //  cofactors.h11 + ' ' + cofactors.h12 + ' ' + cofactors.h13 + '\n' +
          //  cofactors.h21 + ' ' + cofactors.h22 + ' ' + cofactors.h23 + '\n' +
          //  cofactors.h31 + ' ' + cofactors.h32 + ' ' + cofactors.h33 + '\n'
          //);
          //console.log(
          //  'Hessian Adjunct / Cofactors Transposed : \n' +
          //  adjunct.h11 + ' ' + adjunct.h12 + ' ' + adjunct.h13 + '\n' +
          //  adjunct.h21 + ' ' + adjunct.h22 + ' ' + adjunct.h23 + '\n' +
          //  adjunct.h31 + ' ' + adjunct.h32 + ' ' + adjunct.h33 + '\n'
          //);
          //console.log(
          //  'Hessian Inverse : \n' +
          //  hessian_inverse.h11 + ' ' + hessian_inverse.h12 + ' ' + hessian_inverse.h13 + '\n' +
          //  hessian_inverse.h21 + ' ' + hessian_inverse.h22 + ' ' + hessian_inverse.h23 + '\n' +
          //  hessian_inverse.h31 + ' ' + hessian_inverse.h32 + ' ' + hessian_inverse.h33 + '\n'
          //);
          //console.log(
          //  'Hessian x Hessian Inverse : \n' +
          //  Math.round((hessian.h11 * hessian_inverse.h11) + (hessian.h12 * hessian_inverse.h21) + (hessian.h13 * hessian_inverse.h31)) + ' ' +
          //  Math.round((hessian.h11 * hessian_inverse.h12) + (hessian.h12 * hessian_inverse.h22) + (hessian.h13 * hessian_inverse.h32)) + ' ' +
          //  Math.round((hessian.h11 * hessian_inverse.h13) + (hessian.h12 * hessian_inverse.h23) + (hessian.h13 * hessian_inverse.h33)) + '\n' +
          //  Math.round((hessian.h12 * hessian_inverse.h11) + (hessian.h22 * hessian_inverse.h21) + (hessian.h23 * hessian_inverse.h31)) + ' ' +
          //  Math.round((hessian.h12 * hessian_inverse.h12) + (hessian.h22 * hessian_inverse.h22) + (hessian.h23 * hessian_inverse.h32)) + ' ' +
          //  Math.round((hessian.h12 * hessian_inverse.h13) + (hessian.h22 * hessian_inverse.h23) + (hessian.h23 * hessian_inverse.h33)) + '\n' +
          //  Math.round((hessian.h13 * hessian_inverse.h11) + (hessian.h23 * hessian_inverse.h21) + (hessian.h33 * hessian_inverse.h31)) + ' ' +
          //  Math.round((hessian.h13 * hessian_inverse.h12) + (hessian.h23 * hessian_inverse.h22) + (hessian.h33 * hessian_inverse.h32)) + ' ' +
          //  Math.round((hessian.h13 * hessian_inverse.h13) + (hessian.h23 * hessian_inverse.h23) + (hessian.h33 * hessian_inverse.h33)) + '\n'
          //);
          //console.log('----');


          //Now the interpolation offset is calculated by multiplying
          //the Gradient vector by the Negative Inverse of the Hessian.
          interpolation_offset = [
            (((hessian_inverse.h11 * -1) * gradient.s) + ((hessian_inverse.h12 * -1) * gradient.m) + ((hessian_inverse.h13) * gradient.n)),
            (((hessian_inverse.h21 * -1) * gradient.s) + ((hessian_inverse.h22 * -1) * gradient.m) + ((hessian_inverse.h23) * gradient.n)),
            (((hessian_inverse.h31 * -1) * gradient.s) + ((hessian_inverse.h32 * -1) * gradient.m) + ((hessian_inverse.h33) * gradient.n)),
          ];


          //Now the interpolation offset is calculated by first multiplying
          //the G


          break;
        }
      });

    }
  }
}